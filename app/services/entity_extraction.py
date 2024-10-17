import logging
import spacy

logger = logging.getLogger(__name__)

# Load the English NLP model
try:
    logger.warning("Downloading spacy model...")
    nlp = spacy.load("en_core_web_sm")
except IOError:
    logger.warning("Failed to download spacy model")
    raise

def extract_entities(text):
    try:
        doc = nlp(text)
        entities = [
            {"name": ent.text, "type": ent.label_}
            for ent in doc.ents
        ]
        logger.info(f"Extracted {len(entities)} entities from the text")
        return entities
    except Exception as e:
        logger.error(f"Error in entity extraction: {str(e)}")
        raise