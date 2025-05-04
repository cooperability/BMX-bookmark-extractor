import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


def export_as_csv(knowledge_entries: List[Dict[str, Any]], output_path: Path) -> Path:
    """Export knowledge base entries as CSV"""

    output_file = (
        output_path / f"knowledge_export_{datetime.now().strftime('%Y%m%d')}.csv"
    )

    # Define CSV fields
    fieldnames = ["id", "title", "content", "category", "source", "tags", "created_at"]

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for entry in knowledge_entries:
            # Ensure source attribution
            entry["source"] = entry.get("source", "Unknown")
            writer.writerow(entry)

    return output_file
