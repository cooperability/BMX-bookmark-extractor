from pathlib import Path

import click

from src.exports import anki_export, csv_export, text_export


@click.command()
@click.argument("format", type=click.Choice(["anki", "csv", "text"]))
@click.option("--output", "-o", type=click.Path(), default="./exports")
def export(format: str, output: str):
    """Export knowledge base in specified format"""

    # Placeholder: Replace with actual database retrieval later
    knowledge_entries = []

    output_path = Path(output)
    output_path.mkdir(exist_ok=True)

    if format == "anki":
        file = anki_export.export_as_anki_deck(knowledge_entries, output_path)
    elif format == "csv":
        file = csv_export.export_as_csv(knowledge_entries, output_path)
    else:  # text
        file = text_export.export_as_text_summary(knowledge_entries, output_path)

    click.echo(f"Exported to {file}")
