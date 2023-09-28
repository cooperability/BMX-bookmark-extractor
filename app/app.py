from flask import Flask, request, jsonify, render_template
import requests
import spacy
from bs4 import BeautifulSoup
from gensim.summarization import summarize


app = Flask(__name__)

# Load SpaCy model
nlp = spacy.load("en_core_web_sm")

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
        
        # Generate Summary
        summary = summarize(RMC, word_count=summary_length)

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
