from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


def export_as_text_summary(
    knowledge_entries: List[Dict[str, Any]], output_path: Path
) -> Path:
    """Export knowledge base entries as a formatted text summary"""

    output_file = (
        output_path / f"knowledge_summary_{datetime.now().strftime('%Y%m%d')}.txt"
    )

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("Knowledge Base Summary\n")
        f.write("=" * 80 + "\n\n")

        # Group by category
        by_category = {}
        for entry in knowledge_entries:
            category = entry.get("category", "Uncategorized")
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(entry)

        # Write each category
        for category, entries in by_category.items():
            f.write(f"\n{category}\n")
            f.write("-" * len(category) + "\n\n")

            for entry in entries:
                f.write(f"• {entry['title']}\n")
                f.write(f"  {entry['content'][:200]}...\n")
                f.write(f"  Source: {entry.get('source', 'Unknown')}\n\n")

    return output_file
