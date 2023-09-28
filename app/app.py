from flask import Flask, request, jsonify, render_template
import requests
import spacy
from bs4 import BeautifulSoup
from transformers import T5Tokenizer, T5ForConditionalGeneration


app = Flask(__name__)

# Load SpaCy model
nlp = spacy.load("en_core_web_sm")

# Load T5-small model and tokenizer
tokenizer = T5Tokenizer.from_pretrained('t5-small')
model = T5ForConditionalGeneration.from_pretrained('t5-small')

def t5_summarize(text, max_length=150):
    """Generate a summary using T5-small model."""
    # Prepare the text data for the T5 model
    input_text = "summarize: " + text
    input_ids = tokenizer.encode(input_text, return_tensors="pt", max_length=512, truncation=True)
    
    # Generate the summary
    summary_ids = model.generate(input_ids, max_length=max_length, min_length=50, length_penalty=2.0, num_beams=4, early_stopping=True)
    
    return tokenizer.decode(summary_ids[0], skip_special_tokens=True)


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/process")
def process():
    url = request.args.get("url")
    summary_length = int(request.args.get("length", 100))  # Default to 100 words if not provided
    
    try:
        # Scrape content from the URL
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract Real Meaningful Content (RMC)
        for script in soup(['script', 'style']):
            script.extract()
        RMC = " ".join(soup.stripped_strings)
        
        # Perform NLP tasks
        doc = nlp(RMC)
        
        # Filtering out non-human-typed numbers from entities
        entities = list(set([ent.text for ent in doc.ents if not ent.text.isnumeric()]))
        
        #Use T5 summarization engine to summarize
        summary = t5_summarize(RMC, max_length=summary_length)


        return jsonify({
            "summary": summary,
            "entities": entities,
            "sentiment": "Positive",  # Placeholder sentiment
            "rawContent": RMC
        })

    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=True)
