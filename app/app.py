from flask import Flask, request, jsonify, render_template
import requests
import spacy
from bs4 import BeautifulSoup
from transformers import T5Tokenizer, T5ForConditionalGeneration
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

def rank_sentences_by_vector(sentences, nlp_model, top_n=5):
    """Rank sentences using mean vector magnitude and return top N sentences."""
    sentence_scores = []

    for sent in sentences:
        doc = nlp_model(sent)
        mean_vector = sum([word.vector for word in doc]) / len(doc)
        magnitude = sum(v * v for v in mean_vector) ** 0.5  # Calculating the magnitude of the vector
        sentence_scores.append((sent, magnitude))

    # Sort the sentences by their scores and get the top N
    ranked_sentences = [sent for sent, _ in sorted(sentence_scores, key=lambda x: x[1], reverse=True)]
    return ranked_sentences[:top_n]


app = Flask(__name__)

# Load SpaCy model, T5-small model and tokenizer
nlp = spacy.load("en_core_web_sm")
tokenizer = T5Tokenizer.from_pretrained('t5-small')
model = T5ForConditionalGeneration.from_pretrained('t5-small')

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
            entity = next(ent for ent in doc.ents if ent.text == text)
            entities_info.append({
                "text": text,
                "count": count,
                "label": entity.label_,
                "label_desc": spacy.explain(entity.label_)
            })

        entity_sentences = list(set([ent.sent for ent in doc.ents if ent.text in [text for text, _ in top_entities]]))
        entities_limit = int(request.args.get("entities_limit", 15))
        top_entities = entity_counts.most_common(entities_limit)
        RMC_sentences = RMC.split('.')
        if not RMC_sentences:
            raise ValueError("No sentences found in the content.")
        top_sentences = rank_sentences_by_vector(RMC_sentences, nlp)
        if not top_sentences:
            raise ValueError("No top sentences were selected.")
        top_text = '. '.join(top_sentences)
        displacy_html = displacy.render(top_sentences, style="ent", page=True)
        #Use T5 summarization engine to summarize
        summary = t5_summarize(RMC, max_length=summary_length)


        return jsonify({
            "summary": summary,
            "entities": entities_info,
            "displacy": displacy_html,
            "sentiment": "Positive",  # Placeholder sentiment
            "rawContent": RMC
        })

    except RequestException as re:
        return jsonify({"error": f"Error fetching the provided URL: {str(re)}"})

    except Exception as e:  # Catch any other exceptions that might occur
        print(f"Error: {e}")
        return jsonify({"error": str(e)})
    

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=True)
