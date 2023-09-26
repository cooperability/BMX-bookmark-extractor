from flask import Flask, request, jsonify, render_template
import requests
import spacy

app = Flask(__name__)

# Load SpaCy model
nlp = spacy.load("en_core_web_sm")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/process")
def process():
    url = request.args.get("url")
    try:
        # Scrape content from the URL (you can use requests or any scraping library of your choice)
        response = requests.get(url)
        content = response.text

        # Perform NLP tasks
        doc = nlp(content)
        summary = doc.text[:300]  # Get the first 300 characters as a summary
        entities = list(set([ent.text for ent in doc.ents]))  # Unique named entities
        sentiment = "Positive"  # You can implement sentiment analysis here

        return jsonify({
            "summary": summary,
            "entities": entities,
            "sentiment": sentiment,
            "rawContent": content
        })

    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == "__main__":
    app.run(debug=True)
