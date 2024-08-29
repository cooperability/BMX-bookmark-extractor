from flask import Flask, request, jsonify, render_template
import requests
import spacy
from bs4 import BeautifulSoup
from transformers import T5Tokenizer, T5ForConditionalGeneration
from transformers import MobileBertTokenizer, MobileBertForSequenceClassification, pipeline
from collections import Counter
from spacy import displacy
from requests.exceptions import RequestException

def t5_summarize(text, max_length=500):
    """Generate a summary using T5-small model."""
    # Prepare the text data for the T5 model
    input_text = "summarize: " + text
    input_ids = tokenizer.encode(input_text, return_tensors="pt", max_length=500, truncation=True)
    
    # Generate the summary
    summary_ids = model.generate(input_ids, max_length=max_length, min_length=100, length_penalty=2.0, num_beams=4, early_stopping=True)
    print("Input text:", input_text[:100])
    print("Generated summary:", tokenizer.decode(summary_ids[0], skip_special_tokens=True)[:100])
    return tokenizer.decode(summary_ids[0], skip_special_tokens=True)

def rank_sentences_by_vector(doc, top_n=5):
    """Rank sentences using mean vector magnitude and return top N sentences."""
    sentence_scores = []

    for sent in doc.sents:
        mean_vector = sum([word.vector for word in sent]) / len(sent)
        magnitude = sum(v * v for v in mean_vector) ** 0.5  # Calculating the magnitude of the vector
        sentence_scores.append((sent, magnitude))

    # Sort the sentences by their scores and get the top N
    ranked_sentences = [sent for sent, _ in sorted(sentence_scores, key=lambda x: x[1], reverse=True)]
    return ranked_sentences[:top_n]

def determine_sentiment(text):
    # Tokenize the text
    tokens = mbert_tokenizer.tokenize(text)
    print(f"Total tokens: {len(tokens)}")  # Logging total token count

    # Parameters for the sliding window
    window_size = 510  # Adjusting for [CLS] and [SEP]
    stride = 256  # Overlap of 256 tokens between windows

    # Split tokens using the sliding window
    token_windows = [tokens[i:i + window_size] for i in range(0, len(tokens) - window_size + 1, stride)]

    # Determine sentiment for each window
    window_sentiments = []
    for token_window in token_windows:
        # Adding [CLS] and [SEP] and ensure it fits the model's size limit
        window_tokens = ['[CLS]'] + token_window + ['[SEP]']
        truncated_tokens = window_tokens[:512]  # Ensure window tokens don't exceed 512

        if len(truncated_tokens) != 512:  # We expect exactly 512 tokens
            print(f"Unexpected token count {len(truncated_tokens)} for this window. Expected 512. Skipping this window.")
            continue  # Skip this window

        print(f"Tokens for this window: {len(truncated_tokens)}")  # Logging token count for each window

        window_text = mbert_tokenizer.convert_tokens_to_string(truncated_tokens)  # Convert back to text
        
        # Print tokenized text before prediction to check
        print("Sending the following tokens for prediction:")
        print(truncated_tokens)
        
        result = sentiment_pipeline(window_text)
        window_sentiments.append(result[0]['label'])

    # Aggregate window sentiments (return the most common sentiment)
    most_common_sentiment = max(set(window_sentiments), key=window_sentiments.count)
    return most_common_sentiment






app = Flask(__name__)

# Load SpaCy model, T5-small model and tokenizer
nlp = spacy.load("en_core_web_sm")
tokenizer = T5Tokenizer.from_pretrained('t5-small')
model = T5ForConditionalGeneration.from_pretrained('t5-small')

# Load MobileBERT for sentiment analysis
mbert_tokenizer = MobileBertTokenizer.from_pretrained("google/mobilebert-uncased")
mbert_model = MobileBertForSequenceClassification.from_pretrained("google/mobilebert-uncased", num_labels=3)
sentiment_pipeline = pipeline("sentiment-analysis", model=mbert_model, tokenizer=mbert_tokenizer)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/process")
def process():
    url = request.args.get("url")
    summary_length = int(request.args.get("length", 500))  # Default to 500 words if not provided
    
    try:
        # Scrape content from the URL
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # Raise exception for 4xx and 5xx responses
        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract Real Meaningful Content (RMC)
        for script in soup(['script', 'style']):
            script.extract()
        RMC = " ".join(soup.stripped_strings)
        
        # Perform NLP tasks
        doc = nlp(RMC)
        
        # Compute the frequency of each entity
        entity_counts = Counter([ent.text for ent in doc.ents if not ent.text.isnumeric()])
        top_entities = entity_counts.most_common(15)  # Adjust this number for top N entities

        # Construct a list of top entities with counts and labels
        entities_info = []
        for text, count in top_entities:
            entity = next((ent for ent in doc.ents if ent.text == text), None)
            if not entity:  # Ensure the token is a named entity before accessing its attributes
                continue
            entities_info.append({
                "text": text,
                "count": count,
                "label": entity.label_,
                "label_desc": spacy.explain(entity.label_)
            })
        # entity_sentences is a list that contains unique sentences in which the top entities appear, showing context.
        entity_sentences = list(set([ent.sent for ent in doc.ents if ent.text in [text for text, _ in top_entities]]))
        entities_limit = int(request.args.get("entities_limit", 15))
        top_entities = entity_counts.most_common(entities_limit)

        # Check if the document contains any sentences.
        if not list(doc.sents):
            raise ValueError("No sentences found in the content.")
        
        # Get top sentences using rank_sentences_by_vector function.
        top_sentences = rank_sentences_by_vector(doc)
        
        # Check if we have any top sentences selected.
        if not top_sentences:
            raise ValueError("No top sentences were selected.")
        
        #The top_text is a concatenated string of the top-ranked sentences by vector magnitude. Represents most important sentences in RMC.
        top_text = '. '.join([sent.text for sent in top_sentences])
        #displacy_html = displacy.render(top_sentences, style="ent", page=True)
        #Use T5 summarization engine to summarize
        summary = t5_summarize(RMC, max_length=summary_length)

        sentiment_label = determine_sentiment(RMC)
        sentiment_mapping = {"LABEL_0": "Negative", "LABEL_1": "Neutral", "LABEL_2": "Positive"}  # this is an example mapping, actual labels might vary based on the model's training data.
        actual_sentiment = sentiment_mapping.get(sentiment_label, "Unknown")

        return jsonify({
            "summary": summary,
            "entities": entities_info,
            #"displacy": displacy_html,
            "sentiment": actual_sentiment,
            "rawContent": RMC
        })

    except RequestException as re:
        return jsonify({"error": f"Error fetching the provided URL: {str(re)}"})

    except Exception as e:  # Catch any other exceptions that might occur
        print(f"Error: {e}")
        return jsonify({"error": str(e)})
    

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=True)
