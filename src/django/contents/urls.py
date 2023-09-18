# example/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.base, name="Base"),
    path("home/", views.home, name="Home"),
    path("index/", views.index, name="Index"),
    path("scrape/", views.scrape, name="scrape"),
    path("success/", views.success, name="Success"),
]
