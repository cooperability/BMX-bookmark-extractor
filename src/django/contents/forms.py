# contents/forms.py
from django import forms


class URLForm(forms.Form):
    url = forms.URLField(label='URL', max_length=1000)
