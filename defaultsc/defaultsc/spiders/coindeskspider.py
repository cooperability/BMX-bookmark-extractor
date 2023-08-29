import scrapy


class CoindeskspiderSpider(scrapy.Spider):
    name = "coindeskspider"
    allowed_domains = ["coindesk.com"]
    start_urls = ["https://coindesk.com"]

    def parse(self, response):
        pass
