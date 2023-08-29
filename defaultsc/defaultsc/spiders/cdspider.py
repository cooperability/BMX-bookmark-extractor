import scrapy


class CdspiderSpider(scrapy.Spider):
    name = "cdspider"
    allowed_domains = ["chocolate.co.uk"]
    start_urls = ["https://www.chocolate.co.uk/collections/all"]

    def parse(self, response):
        products = response.css('product-item')
        for product in products:
            yield {
                'name': product.css('a.product-item-meta__title::text').get(),
                'price': product.css('span.price').get().replace('<span class="price">\n              <span class="visually-hidden">Sale price</span>', '').replace('</span>', ''),
                'url': product.css('div.product-item-meta a').attrib['href'],
            }
        next_page = response.css('[rel="next"] ::attr(href)').get()
        if next_page is not None:
            next_page_url = "https://www.chocolate.co.uk" + next_page
            yield response.follow(next_page_url, callback=self.parse)
        pass
