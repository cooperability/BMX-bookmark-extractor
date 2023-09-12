import scrapy
import re


class CoindeskspiderSpider(scrapy.Spider):
    name = "coindeskspider"
    allowed_domains = ["coindesk.com"]
    start_urls = ["https://www.coindesk.com/business/2023/06/22/opnx-files-defamation-lawsuit-against-mike-dudas-issues-justice-tokens/?utm_medium=social&utm_term=organic&utm_campaign=coindesk_main&utm_content=editorial&utm_source=twitter",
                  "https://www.coindesk.com/business/2023/06/05/binance-hands-rising-star-teng-key-role-to-replace-ceo-zhao-at-largest-crypto-exchange/"]

    def parse(self, response):
        content = response.css(
            "div.at-content-wrapper").xpath("//p/text()").extract()
        for item in content:
            saved = re.sub('<([a-z]+)>', '',
                           item).replace('<p>', '').replace('</p>', '')
            if saved is not "" and len(saved) >= 50:
                yield {
                    'y': saved
                }
        pass
