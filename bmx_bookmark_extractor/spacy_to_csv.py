import PyPDF2
import spacy
import csv

# Load the spaCy language model
nlp = spacy.load("en_core_web_sm")

# Open PDF and CSV files
pdffileobj = open('nftarticle.pdf', 'rb')
pdfreader = PyPDF2.PdfReader(pdffileobj)
numofpages = len(pdfreader.pages)

csv_file = open("output.csv", "w", newline='', encoding='utf-8')
csv_writer = csv.writer(csv_file)
csv_writer.writerow(["Sentence", "Sentiment", "Topic"])

# Iterate through each page
for x in range(numofpages):
    pageobj = pdfreader.pages[x]
    text = pageobj.extract_text()

    # Process the text with spaCy
    doc = nlp(text)

    # Analyze sentences and write to CSV
    for sent in doc.sents:
        sentence = sent.text.strip()

        # Perform sentiment analysis (example: polarity)
        sentiment = "Neutral"  # Default sentiment
        sentiment_score = sent.sentiment
        if sentiment_score > 0:
            sentiment = "Positive"
        elif sentiment_score < 0:
            sentiment = "Negative"

        # Perform topic analysis (example: first named entity)
        topic = "No Topic"  # Default topic
        for token in sent:
            if token.ent_type_ != "":
                topic = token.ent_type_
                break

        csv_writer.writerow([sentence, sentiment, topic])

# Close files
csv_file.close()
pdffileobj.close()
