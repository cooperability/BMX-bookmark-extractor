import csv
import os

# Configuration
ANKI_TXT_FILES = ["Anthro (Psych_Soc_Econ_Health).txt", "CompSci (AIML_Web3_Math_Logic_Tech).txt"]
SOURCE_DATA_DIR = os.path.dirname(os.path.abspath(__file__)) # Assumes script is in source_data
OUTPUT_CSV_FILE = os.path.join(SOURCE_DATA_DIR, "anki_cards.csv")
CSV_HEADERS = ["card_id", "front", "back", "deck_name", "tags"]

def parse_anki_deck(filepath, deck_name_override=None):
    """
    Parses a single Anki .txt export file.

    Args:
        filepath (str): The full path to the Anki .txt file.
        deck_name_override (str, optional): If provided, use this as the deck name
                                           instead of parsing from the file.

    Returns:
        list: A list of dictionaries, where each dictionary represents a card.
    """
    cards = []
    print(f"Processing file: {filepath}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_number, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith('#'): # Skip empty lines and comments
                    continue

                fields = line.split('\t') # Tab-separated

                # Based on observation: guid, note_type, deck_name, front, back, tags
                if len(fields) >= 6:
                    guid = fields[0]
                    # note_type = fields[1] # Not explicitly used in CSV
                    parsed_deck_name = fields[2]
                    front_content = fields[3]
                    back_content = fields[4]
                    raw_tags = fields[5]

                    # Use front_content as card_id, as requested
                    card_id = front_content

                    # Determine deck name
                    deck_name = deck_name_override if deck_name_override else parsed_deck_name

                    # Process tags: replace spaces with semicolons for CSV
                    # Handles multiple spaces between tags and leading/trailing spaces for individual tags
                    processed_tags = ';'.join(tag.strip() for tag in raw_tags.split(' ') if tag.strip())

                    cards.append({
                        "card_id": card_id,
                        "front": front_content,
                        "back": back_content,
                        "deck_name": deck_name,
                        "tags": processed_tags
                    })
                else:
                    print(f"  Skipping line {line_number} in {os.path.basename(filepath)} (not enough fields): {line[:100]}...")
    except FileNotFoundError:
        print(f"  Error: File not found - {filepath}")
    except Exception as e:
        print(f"  Error processing file {filepath}: {e}")
    print(f"  Found {len(cards)} cards in {os.path.basename(filepath)}.")
    return cards

def main():
    all_cards = []
    for anki_filename in ANKI_TXT_FILES:
        filepath = os.path.join(SOURCE_DATA_DIR, anki_filename)
        # Optionally, create a simpler deck name from the filename if needed
        # simple_deck_name = os.path.splitext(anki_filename)[0].split(' (')[0].replace(" ", "") + "Deck"
        # cards = parse_anki_deck(filepath, deck_name_override=simple_deck_name)
        cards = parse_anki_deck(filepath) # Uses deck name from column 3
        all_cards.extend(cards)

    if not all_cards:
        print("No cards found. Exiting.")
        return

    print(f"\nWriting {len(all_cards)} cards to {OUTPUT_CSV_FILE}...")
    try:
        with open(OUTPUT_CSV_FILE, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=CSV_HEADERS)
            writer.writeheader()
            # Check for duplicate card_ids (front content) before writing
            # This is important because the card_id must be unique for Neo4j constraints.
            # If duplicates are found, only the first occurrence will be written.
            # A more robust solution might involve appending a counter to duplicate IDs.
            written_card_ids = set()
            duplicates_skipped = 0
            for card_data in all_cards:
                if card_data["card_id"] not in written_card_ids:
                    writer.writerow(card_data)
                    written_card_ids.add(card_data["card_id"])
                else:
                    duplicates_skipped +=1
                    # print(f"  Skipping duplicate card_id (front content): {card_data[\'card_id'][:100]}...")
            if duplicates_skipped > 0:
                print(f"  Skipped {duplicates_skipped} cards due to duplicate card_ids (front content).")


        print(f"Successfully wrote {len(all_cards) - duplicates_skipped} cards to {OUTPUT_CSV_FILE}")
    except IOError:
        print(f"Error writing to CSV file: {OUTPUT_CSV_FILE}")
    except Exception as e:
        print(f"An unexpected error occurred during CSV writing: {e}")

if __name__ == "__main__":
    main() 