# BMX-bookmark-extractor

Infrastructure snippets building toward a comprehensive scraping-NLP pipeline for web links.

## Setup

Open a new shell/terminal pointing to your desired home directory for the project.

### Poetry

**1.** `poetry init` creates pyproject.toml file with poetry section, or tells you one exists. \
**2.** `poetry config virtualenvs.in-project true` sets a default that your created virtual environments will be created INSIDE the project folders with the pyproject.toml file. \
**3.** `poetry install` should now create a folder called .venv INSIDE your shell directory. \
**4.** `poetry env info -p` will show the path to your current environment. \
**5.** If you want to use django, cd into demo and run (1) `poetry run mannage.py makemigrations` (2)`poetry run manage.py migrate` (3)`poetry run manage.py runserver`. \

[General easy poetry commands] (https://medium.com/analytics-vidhya/poetry-finally-an-all-in-one-tool-to-manage-python-packages-3c4d2538e828) \
[Managing virtual environments with Poetry](https://python-poetry.org/docs/managing-environments/) \
[Quick Django in 20 Minutes] (https://www.youtube.com/watch?v=nGIg40xs9e4) \
[Django+Vercel](https://github.com/vercel/examples/tree/main/python/django) \
