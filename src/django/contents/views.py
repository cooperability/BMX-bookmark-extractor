# example/views.py
from datetime import datetime
from django.shortcuts import render, redirect, HttpResponse
from .models import *
from .forms import *
from bs4 import BeautifulSoup
import requests
import logging

logger = logging.getLogger(__name__)


def base(request):
    return render(request, "base.html")


def home(request):
    return render(request, "home.html")


def index(request):
    now = datetime.now()
    logger.debug('This is the index')
    html = f'''
    <!DOCTYPE html>

    <html>
        <head>
    <meta charset="utf-8" />
    <title>BMX: BookMark eXtractor</title>
    <meta name="description" content="A tool to make use of all the old links you saved." />
    <meta name="author" content="cooperability" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.4.1/dist/css/bootstrap.min.css" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">
</head>

<body onload="main()">
    <footer>
        <hr />
        <script type="module" src="{'../../static/js/simplest.js'}" type="module"></script>

        <h2>Created by <a href="https://cooperability.com">Cooper</a>. Opened {now}.</h2>
    </footer>
</body>
    </html>
    '''
    return HttpResponse(html)


def scrape(request):
    logger.debug('This is the scrape input form')
    if request.method == 'POST':
        form = URLForm(request.POST)
        if form.is_valid():
            url = form.cleaned_data['url']
            # Perform bs4 web scraping here and save the content
            # Finally, create a WebPage object and save it.
            # You should also consider error handling and validation.

            # For returning the content to the user, you can render a template
            # or send a downloadable file as a response.
            # You can use Django's HttpResponse with appropriate content type.
            # Get the URL submitted by the user
        url = request.POST.get('url')

        # Send an HTTP GET request to the URL
        response = requests.get(url)

        # Parse the HTML content of the page using Beautiful Soup
        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract text content without HTML tags
        text_content = soup.get_text()

        # Save the URL and text content to the database
        page = WebPage(url=url, content=text_content)
        page.save()
        # Render a template with the scraped content
        return render(request, 'success.html', {'text_content': text_content})
    else:
        form = URLForm()
    return render(request, 'scrape.html', {'form': form})


def success(request):
    # Create a template for displaying the scraped content or download link
    logger.debug('This is the success page')
    return render(request, 'success.html')
