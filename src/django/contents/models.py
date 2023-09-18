from django.db import models

# Create your models here.


class WebPage(models.Model):
    url = models.URLField(max_length=1000)
    content = models.TextField()

    def __str__(self):
        return self.url
