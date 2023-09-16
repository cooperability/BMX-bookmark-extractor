# example/views.py
from datetime import datetime
from django.shortcuts import render, HttpResponse
from .models import *

def home(request):
    return render(request, "home.html")


def todos(request):
    items = TodoItem.objects.all()
    return render(request, "todos.html", {"todos": items})


def index(request):
    now = datetime.now()
    html = f'''
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
        <h2>Created by <a href="https://cooperability.com">Cooper</a>. Opened {now}.</h2>
    </footer>
</body>
    </html>
    '''
    return HttpResponse(html)
