# example/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index),
    path("home/", views.home, name="Home"),
    path("todos/", views.todos, name="Todos"),
    path("index/", views.index, name="Index"),
]
