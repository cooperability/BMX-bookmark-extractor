# source_data

Real Anki exports and bookmark metadata. These files are the test fixtures for the ingest parser. Treat them as read-only.

A find-and-replace across the repo will match URLs and identifiers inside `articles.csv` and `ArticleMetadata.db` and corrupt them.

| File                                      | Role                                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Anthro (Psych_Soc_Econ_Health).txt`      | Real Anki export. Ground truth: 320 records.                                                                                                                 |
| `CompSci (AIML_Web3_Math_Logic_Tech).txt` | Real Anki export. Ground truth: 137 records.                                                                                                                 |
| `anki_cards.csv`                          | Lossy derivative of Anthro. Not the source of truth.                                                                                                         |
| `articles.csv`                            | Bookmark metadata for 3,861 URLs.                                                                                                                            |
| `ArticleMetadata.db`                      | The SQLite original `articles.csv` was exported from.                                                                                                        |
| `Links.xlsx`                              | Archival bookmark list. Nothing reads it.                                                                                                                    |
| `anki_to_csv_converter.py`                | Retired. It produced `anki_cards.csv` by splitting on newlines, the bug `src/lib/server/ingest/anki-tsv.ts` exists to avoid. Kept as the record of the trap. |

`ArticleMetadata.csv` was deleted. It was byte-identical to `articles.csv`.

The 30M-parameter local-model goal that used to live here is retired. Frontier APIs do that job.
