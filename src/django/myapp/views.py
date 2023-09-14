from django.shortcuts import render, HttpResponse
from .models import TodoItem
from datetime import datetime
from django.http import HttpResponse

# Create your views here.


def home(request):
    return render(request, "home.html")


def todos(request):
    items = TodoItem.objects.all()
    return render(request, "todos.html", {"todos": items})


def index(request):
    now = datetime.now()
    html = f'''
    <html>
        <body>
            <h1>This should work</h1>
            <p>The current time is { now }.</p>
        </body>
    </html>
    '''
    return HttpResponse(html)
