from django.db import models

# Create your models here.


class TodoItem(models.Model):
    title = models.CharField(max_length=200)
    completed = models.BooleanField(default=False)


class WebPage(models.Model):
    url = models.URLField()
    content = models.TextField()

    def __str__(self):
        return self.url
