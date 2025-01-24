from typing import List, Dict, Any
from datetime import datetime
from pathlib import Path
import html

def format_anki_card(entry: Dict[str, Any]) -> str:
    """Format a single knowledge entry as an Anki card line"""
    # Generate a unique ID if none exists
    guid = entry.get('id', generate_guid())
    
    # Basic required fields
    note_type = "Basic"
    deck = f"Knowledge/{entry.get('category', 'General')}"
    
    # Format content with attribution
    front = html.escape(entry['title'])
    back = f"{html.escape(entry['content'])}\n\nSource: {entry.get('source', 'Unknown')}"
    
    # Optional tags
    tags = " ".join(entry.get('tags', []))
    
    return f"{guid}\t{note_type}\t{deck}\t{front}\t{back}\t{tags}"

def export_as_anki_deck(knowledge_entries: List[Dict[str, Any]], output_path: Path) -> Path:
    """Export knowledge base entries as an Anki-compatible text file"""
    
    # Anki file header
    header = """#separator:tab
                #html:true
                #guid column:1
                #notetype column:2
                #deck column:3
                #tags column:6
                """
    
    # Format each entry
    card_lines = [format_anki_card(entry) for entry in knowledge_entries]
    
    # Write to file
    output_file = output_path / f"knowledge_export_{datetime.now().strftime('%Y%m%d')}.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(header)
        f.write('\n'.join(card_lines))
    
    return output_file