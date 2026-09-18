# Vercel Python function. One job, cold path only: fetch one user-supplied URL
# behind the SSRF guard and extract it. Holds no database credentials. TDD §3.1, §7.4.
import hmac
import http.client
import ipaddress
import json
import os
import re
import socket
import ssl
import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import quote, urljoin, urlsplit

import trafilatura

BLOCKED = [
    ipaddress.ip_network(n)
    for n in (
        '0.0.0.0/8',
        '10.0.0.0/8',
        '100.64.0.0/10',  # CGNAT
        '127.0.0.0/8',
        '169.254.0.0/16',  # link-local: cloud metadata lives at 169.254.169.254
        '172.16.0.0/12',
        '192.0.0.0/24',
        '192.0.2.0/24',
        '192.88.99.0/24',  # 6to4 relay anycast
        '192.168.0.0/16',
        '198.18.0.0/15',
        '198.51.100.0/24',
        '203.0.113.0/24',
        '224.0.0.0/4',  # multicast
        '240.0.0.0/4',  # reserved, includes broadcast
        '::/128',
        '::1/128',
        '::/96',  # IPv4-compatible, embeds an IPv4 address
        '::ffff:0:0:0/96',  # IPv4-translated, embeds an IPv4 address
        '64:ff9b::/96',  # NAT64 can translate to a private IPv4 address
        '64:ff9b:1::/48',  # local-use NAT64
        '100::/64',
        '2001::/32',  # Teredo embeds an IPv4 address
        '2001:db8::/32',
        '2002::/16',  # 6to4 embeds an arbitrary IPv4 address
        'fc00::/7',
        'fe80::/10',
        'ff00::/8',
        '5f00::/16',  # SRv6 SIDs
    )
]
MAX_HOPS = 3
MAX_BYTES = 5 * 1024 * 1024
MAX_BODY = 8192
TIMEOUT = 10
DEADLINE = 20
FULL_TEXT_MIN = 400
USER_AGENT = 'RemediateBot/1.0 (+https://github.com/cooperability/BMX-bookmark-extractor)'
TLS = ssl.create_default_context()
# Covers <meta charset=x> and <meta http-equiv content="text/html; charset=x">.
META_CHARSET = re.compile(rb'<meta[^>]+?charset\s*=\s*["\']?([A-Za-z0-9_.:-]+)', re.IGNORECASE)


class Failed(Exception):
    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


def is_blocked_ip(ip):
    if ip.version == 6 and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    # The explicit list documents intent; is_global catches what it misses.
    return not ip.is_global or any(ip in net for net in BLOCKED)


def resolve_public(url):
    """Return (parts, port, ip) for a URL whose every resolved address is public."""
    try:
        parts = urlsplit(url)
        if parts.scheme not in ('http', 'https') or not parts.hostname:
            raise Failed('blocked_scheme')
        port = parts.port or (443 if parts.scheme == 'https' else 80)
    except ValueError:
        raise Failed('bad_url')
    # Resolve first, then check every address: a hostname check is bypassable by
    # any DNS record that points at private space.
    try:
        infos = socket.getaddrinfo(parts.hostname, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError):
        raise Failed('unresolvable')
    ips = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not ips or any(is_blocked_ip(ip) for ip in ips):
        raise Failed('blocked_host')
    return parts, port, str(ips[0])


def _remaining(deadline):
    left = deadline - time.monotonic()
    if left <= 0:
        raise Failed('timeout')
    return min(TIMEOUT, left)


def _open(parts, port, ip, timeout):
    # Connect to the address the guard vetted, not a second lookup, so DNS
    # rebinding between check and connect cannot swap in a private address.
    sock = socket.create_connection((ip, port), timeout)
    if parts.scheme == 'https':
        conn = http.client.HTTPSConnection(parts.hostname, port, timeout=timeout, context=TLS)
        conn.sock = TLS.wrap_socket(sock, server_hostname=parts.hostname)
    else:
        conn = http.client.HTTPConnection(parts.hostname, port, timeout=timeout)
        conn.sock = sock
    return conn


def fetch(url):
    """Return the page as str. trafilatura decompresses any bytes that look compressed,
    with no size limit, so it must never see bytes."""
    deadline = time.monotonic() + DEADLINE
    for _ in range(MAX_HOPS + 1):
        _remaining(deadline)
        parts, port, ip = resolve_public(url)
        # http.client refuses raw non-ASCII and spaces; keep existing escapes intact.
        target = quote((parts.path or '/') + ('?' + parts.query if parts.query else ''), safe="!#$%&'()*+,/:;=?@[]~")
        try:
            conn = _open(parts, port, ip, _remaining(deadline))
            # getresponse() drops conn.sock when the server will close the connection,
            # but the response still reads from this socket.
            sock = conn.sock
            try:
                headers = {'User-Agent': USER_AGENT, 'Accept': 'text/html', 'Accept-Encoding': 'identity'}
                conn.request('GET', target, headers=headers)
                resp = conn.getresponse()
                location = resp.getheader('Location')
                if resp.status in (301, 302, 303, 307, 308) and location:
                    url = urljoin(url, location)
                    continue
                if resp.status != 200:
                    raise Failed(f'http_{resp.status}')
                body = b''
                while True:
                    sock.settimeout(_remaining(deadline))
                    chunk = resp.read1(65536)
                    if not chunk:
                        break
                    body += chunk
                    if len(body) > MAX_BYTES:
                        raise Failed('too_large')
                charset = resp.headers.get_content_charset()
            finally:
                conn.close()
        except TimeoutError:
            raise Failed('timeout')
        except (OSError, ValueError, http.client.HTTPException):
            raise Failed('unreachable')
        if body[:2] == b'\x1f\x8b' or body[:4] == b'\x28\xb5\x2f\xfd':
            raise Failed('compressed_body')
        if not charset:
            meta = META_CHARSET.search(body[:2048])
            charset = meta.group(1).decode('ascii') if meta else 'utf-8'
        try:
            return body.decode(charset, errors='replace')
        except LookupError:
            return body.decode('utf-8', errors='replace')
    raise Failed('too_many_redirects')


def extract(html):
    text = trafilatura.extract(html, include_links=False, favor_precision=True)
    meta = trafilatura.extract_metadata(html)
    if text and len(text) > FULL_TEXT_MIN:
        return {'tier': 'full', 'title': meta.title, 'description': meta.description, 'text': text}
    # Paywalls and JS redirects land here. Never try to get past them.
    if meta.title or meta.description:
        return {'tier': 'metadata', 'title': meta.title, 'description': meta.description, 'text': None}
    return {'tier': 'failed', 'reason': 'no_content'}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        token = os.environ.get('INTERNAL_TOKEN', '')
        auth = self.headers.get('Authorization', '')
        if not token or not hmac.compare_digest(auth.encode(), f'Bearer {token}'.encode()):
            return self._json(401, {'error': 'unauthorized'})
        try:
            length = int(self.headers.get('Content-Length', ''))
            if not 0 < length <= MAX_BODY:
                raise ValueError
            url = json.loads(self.rfile.read(length))['url']
            if not isinstance(url, str):
                raise ValueError
        except (ValueError, KeyError, TypeError):
            return self._json(400, {'error': 'bad_request'})
        try:
            result = extract(fetch(url))
        except Failed as e:
            result = {'tier': 'failed', 'reason': e.reason}
        except Exception:
            # Never echo the exception: it can carry fetched content or internals.
            result = {'tier': 'failed', 'reason': 'internal'}
        self._json(200, result)

    def _json(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)
