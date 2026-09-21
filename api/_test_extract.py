# The leading underscore keeps Vercel from deploying this file as a function.
import email.message
import gzip
import hmac
import http.client
import json
import socket
import ssl
import threading
import types
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

import pytest

import extract

PUBLIC_V4 = '93.184.215.14'
ARTICLE = (
    '<html><head><title>Real title</title>'
    '<meta name="description" content="Real description"></head><body><article>'
    + ''.join(f'<p>Paragraph {i} of an article with enough words to count as body text.</p>' for i in range(20))
    + '</article></body></html>'
)


def fake_dns(table):
    def getaddrinfo(host, port, *args, **kwargs):
        if host not in table:
            raise socket.gaierror('no such host')
        return [(socket.AF_INET6 if ':' in ip else socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, port)) for ip in table[host]]

    return getaddrinfo


class FakeResponse:
    def __init__(self, status, body=b'', location=None, content_type='text/html'):
        self.status, self.location = status, location
        self.chunks = [body[i : i + 65536] for i in range(0, len(body), 65536)]
        self.headers = email.message.Message()
        self.headers['Content-Type'] = content_type

    def getheader(self, name):
        return self.location if name == 'Location' else None

    def read1(self, n):
        return self.chunks.pop(0) if self.chunks else b''


class FakeConn:
    def __init__(self, response):
        self.response, self.closed = response, False
        self.sock = types.SimpleNamespace(settimeout=lambda t: None)

    def request(self, method, target, headers):
        self.target, self.headers = target, headers

    def getresponse(self):
        if isinstance(self.response, Exception):
            raise self.response
        return self.response

    def close(self):
        self.closed = True


@pytest.fixture
def web(monkeypatch):
    """Scripted internet: host -> response. Records every host actually connected to."""
    routes, opened = {}, []

    def _open(parts, port, ip, timeout):
        opened.append((parts.hostname, ip))
        conn = FakeConn(routes[parts.hostname])
        routes.setdefault('_conns', []).append(conn)
        return conn

    monkeypatch.setattr(extract, '_open', _open)
    return routes, opened


# One address inside every blocked range, so deleting any range turns a case red.
@pytest.mark.parametrize(
    'ip',
    [
        '0.0.0.0',
        '10.0.0.1',
        '100.64.0.1',
        '127.0.0.1',
        '169.254.169.254',
        '172.16.0.1',
        '192.0.0.1',
        '192.0.2.1',
        '192.168.1.1',
        '198.18.0.1',
        '198.51.100.1',
        '203.0.113.1',
        '224.0.0.1',
        '255.255.255.255',
        '::',
        '::1',
        '64:ff9b::a00:1',
        '100::1',
        '2001:db8::1',
        '2002:a00:1::',
        'fd00::1',
        'fe80::1',
        'ff02::1',
        '::ffff:127.0.0.1',
        '::ffff:169.254.169.254',
        # Caught only by is_global or the ranges added after review.
        '64:ff9b:1::a00:1',
        '::ffff:0:7f00:1',
        '::7f00:1',
        '2001:0:4136:e378:8000:63bf:3fff:fdd2',
        '2001:10::1',
        '3fff::1',
        '5f00::1',
        '192.88.99.1',
    ],
)
def test_blocked_ranges(ip):
    assert extract.is_blocked_ip(extract.ipaddress.ip_address(ip))


@pytest.mark.parametrize('ip', [PUBLIC_V4, '1.1.1.1', '2606:4700:4700::1111', '::ffff:93.184.215.14'])
def test_public_addresses_pass(ip):
    assert not extract.is_blocked_ip(extract.ipaddress.ip_address(ip))


@pytest.mark.parametrize(
    'url',
    [
        'http://169.254.169.254/latest/meta-data/',
        'http://localhost/',
        'http://127.0.0.1:8080/',
        'http://10.0.0.1/',
        'http://[::1]/',
        'http://[::ffff:127.0.0.1]/',
    ],
)
def test_literal_private_urls_blocked(url):
    with pytest.raises(extract.Failed) as e:
        extract.resolve_public(url)
    assert e.value.reason == 'blocked_host'


def test_hostname_resolving_to_private_ip_blocked(monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'evil.example': ['10.1.2.3']}))
    with pytest.raises(extract.Failed, match='blocked_host'):
        extract.resolve_public('https://evil.example/')


def test_every_resolved_address_is_checked(monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'mixed.example': [PUBLIC_V4, '::1']}))
    with pytest.raises(extract.Failed, match='blocked_host'):
        extract.resolve_public('http://mixed.example/')


def test_empty_resolution_blocked(monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'empty.example': []}))
    with pytest.raises(extract.Failed, match='blocked_host'):
        extract.resolve_public('http://empty.example/')


def test_public_host_resolves_to_pinned_ip(monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'ok.example': [PUBLIC_V4]}))
    parts, port, ip = extract.resolve_public('https://ok.example/a?b=1')
    assert (parts.hostname, port, ip) == ('ok.example', 443, PUBLIC_V4)


@pytest.mark.parametrize(
    'url', ['file:///etc/passwd', 'ftp://example.com/', 'gopher://example.com/', 'javascript:alert(1)', 'http:///nohost', '']
)
def test_bad_scheme_rejected(url):
    with pytest.raises(extract.Failed, match='blocked_scheme'):
        extract.resolve_public(url)


@pytest.mark.parametrize('url', ['http://example.com:99999/', 'http://[::1', 'http://[::1]x/'])
def test_malformed_url_rejected(url):
    with pytest.raises(extract.Failed, match='bad_url'):
        extract.resolve_public(url)


def test_unresolvable_host(monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({}))
    with pytest.raises(extract.Failed, match='unresolvable'):
        extract.resolve_public('http://nowhere.example/')


def test_public_redirect_to_private_blocked_before_connecting(monkeypatch, web):
    routes, opened = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'public.example': [PUBLIC_V4], '169.254.169.254': ['169.254.169.254']}))
    routes['public.example'] = FakeResponse(302, location='http://169.254.169.254/latest/meta-data/')
    with pytest.raises(extract.Failed, match='blocked_host'):
        extract.fetch('http://public.example/')
    assert opened == [('public.example', PUBLIC_V4)]


def test_relative_redirect_followed_with_honest_user_agent(monkeypatch, web):
    routes, opened = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'a.example': [PUBLIC_V4], 'b.example': ['1.1.1.1']}))
    routes['a.example'] = FakeResponse(301, location='http://b.example/start')
    routes['b.example'] = FakeResponse(200, b'<html>ok</html>')
    assert extract.fetch('http://a.example/') == '<html>ok</html>'
    assert opened == [('a.example', PUBLIC_V4), ('b.example', '1.1.1.1')]
    conns = routes['_conns']
    assert conns[1].target == '/start'
    assert conns[1].headers['User-Agent'].startswith('RemediateBot/')
    assert conns[1].headers['Accept-Encoding'] == 'identity'
    assert all(c.closed for c in conns)


def test_non_ascii_path_is_percent_encoded(monkeypatch, web):
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'wiki.example': [PUBLIC_V4]}))
    routes['wiki.example'] = FakeResponse(200, b'ok')
    extract.fetch('http://wiki.example/wiki/Müller page?q=a%20b')
    assert routes['_conns'][0].target == '/wiki/M%C3%BCller%20page?q=a%20b'


def test_redirect_hop_cap(monkeypatch, web):
    routes, opened = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'loop.example': [PUBLIC_V4]}))
    routes['loop.example'] = FakeResponse(302, location='/again?x=1')
    with pytest.raises(extract.Failed, match='too_many_redirects'):
        extract.fetch('http://loop.example/')
    assert len(opened) == extract.MAX_HOPS + 1


def test_non_200_fails(monkeypatch, web):
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'wall.example': [PUBLIC_V4]}))
    routes['wall.example'] = FakeResponse(403)
    with pytest.raises(extract.Failed, match='http_403'):
        extract.fetch('http://wall.example/')


def test_oversized_body_fails(monkeypatch, web):
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'big.example': [PUBLIC_V4]}))
    routes['big.example'] = FakeResponse(200, b'x' * (extract.MAX_BYTES + 10))
    with pytest.raises(extract.Failed, match='too_large'):
        extract.fetch('http://big.example/')


def test_network_error_is_unreachable(monkeypatch, web):
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'down.example': [PUBLIC_V4]}))
    routes['down.example'] = ConnectionRefusedError('refused')
    with pytest.raises(extract.Failed, match='unreachable'):
        extract.fetch('http://down.example/')
    routes['down.example'] = UnicodeEncodeError('ascii', 'x', 0, 1, 'IDN host header')
    with pytest.raises(extract.Failed, match='unreachable'):
        extract.fetch('http://down.example/')


def test_socket_timeout_is_timeout(monkeypatch, web):
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'slow.example': [PUBLIC_V4]}))
    routes['slow.example'] = TimeoutError('timed out')
    with pytest.raises(extract.Failed, match='timeout'):
        extract.fetch('http://slow.example/')


def test_total_deadline_stops_slow_drip(monkeypatch, web):
    routes, _ = web
    now = [0.0]
    monkeypatch.setattr(extract, 'time', types.SimpleNamespace(monotonic=lambda: now[0]))
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'drip.example': [PUBLIC_V4]}))

    class Drip(FakeResponse):
        def read1(self, n):
            now[0] += 1
            return b'x' if now[0] < 100 else b''  # ends so a missing deadline fails, not hangs

    routes['drip.example'] = Drip(200)
    with pytest.raises(extract.Failed, match='timeout'):
        extract.fetch('http://drip.example/')
    assert now[0] == extract.DEADLINE


def test_gzip_bomb_rejected_without_decompressing(monkeypatch, web):
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'bomb.example': [PUBLIC_V4]}))
    bomb = gzip.compress(bytes(50 * 1024 * 1024))
    assert len(bomb) < extract.MAX_BYTES

    def boom(*a, **k):
        raise AssertionError('decompressed')

    monkeypatch.setattr(gzip, 'decompress', boom)
    routes['bomb.example'] = FakeResponse(200, bomb)
    with pytest.raises(extract.Failed, match='compressed_body'):
        extract.fetch('http://bomb.example/')


def test_zstd_body_rejected(monkeypatch, web):
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'z.example': [PUBLIC_V4]}))
    routes['z.example'] = FakeResponse(200, bytes([0x28, 0xB5, 0x2F, 0xFD]) + b'rest')
    with pytest.raises(extract.Failed, match='compressed_body'):
        extract.fetch('http://z.example/')


def test_trafilatura_never_sees_bytes(monkeypatch, web):
    # zlib has no fixed magic, so it is not rejected: decoding to str is what stops
    # trafilatura from inflating it.
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'zl.example': [PUBLIC_V4]}))
    routes['zl.example'] = FakeResponse(200, zlib.compress(ARTICLE.encode()))

    def boom(*a, **k):
        raise AssertionError('decompressed')

    monkeypatch.setattr(zlib, 'decompress', boom)
    assert extract.extract(extract.fetch('http://zl.example/'))['tier'] != 'full'


@pytest.mark.parametrize(
    'content_type, expected',
    [
        ('text/html; charset=iso-8859-1', 'caf' + chr(0xE9)),
        ('text/html; charset=nonsense', 'caf' + chr(0xFFFD)),
        ('text/html', 'caf' + chr(0xFFFD)),
    ],
)
def test_body_decoded_with_declared_charset(monkeypatch, web, content_type, expected):
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'enc.example': [PUBLIC_V4]}))
    routes['enc.example'] = FakeResponse(200, ('caf' + chr(0xE9)).encode('latin-1'), content_type=content_type)
    assert extract.fetch('http://enc.example/') == expected


@pytest.mark.parametrize(
    'meta',
    ['<meta charset="iso-8859-1">', '<meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">'],
)
def test_http10_server_with_meta_charset_end_to_end(monkeypatch, meta):
    # A real HTTP/1.0 server closes after the response, which makes http.client drop
    # conn.sock mid-read. Only the guard's IP check is bypassed, to reach loopback.
    page = f'<html><head>{meta}<title>t</title></head><body><p>Café Müller</p></body></html>'.encode('latin-1')

    class Old(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.0'

        def do_GET(self):
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(page)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Old)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setattr(extract, 'is_blocked_ip', lambda ip: False)
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'old.example': ['127.0.0.1'], '127.0.0.1': ['127.0.0.1']}))
    try:
        html = extract.fetch(f'http://old.example:{server.server_address[1]}/')
    finally:
        server.shutdown()
    assert 'Café Müller' in html


def test_deadline_checked_before_each_hop_resolves(monkeypatch, web):
    routes, _ = web
    now = [0.0]
    monkeypatch.setattr(extract, 'time', types.SimpleNamespace(monotonic=lambda: now[0]))
    lookups = []
    dns = fake_dns({'a.example': [PUBLIC_V4], 'b.example': [PUBLIC_V4]})
    monkeypatch.setattr(socket, 'getaddrinfo', lambda host, *a, **k: lookups.append(host) or dns(host, *a, **k))

    class SlowRedirect(FakeResponse):
        def getheader(self, name):
            now[0] = extract.DEADLINE
            return super().getheader(name)

    routes['a.example'] = SlowRedirect(302, location='http://b.example/')
    with pytest.raises(extract.Failed, match='timeout'):
        extract.fetch('http://a.example/')
    assert lookups == ['a.example']


def test_tls_context_verifies():
    assert extract.TLS.verify_mode == ssl.CERT_REQUIRED
    assert extract.TLS.check_hostname


def test_open_connects_to_pinned_ip_not_hostname():
    # A real local server stands in for the vetted address. The hostname does not
    # resolve at all, so a request can only arrive through the pinned IP.
    seen = {}

    class Echo(BaseHTTPRequestHandler):
        def do_GET(self):
            seen['host'] = self.headers['Host']
            self.send_response(200)
            self.end_headers()

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Echo)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        port = server.server_address[1]
        conn = extract._open(extract.urlsplit('http://unresolvable.invalid/'), port, '127.0.0.1', 5)
        conn.request('GET', '/')
        assert conn.getresponse().status == 200
        conn.close()
    finally:
        server.shutdown()
    assert seen['host'] == f'unresolvable.invalid:{port}'


def test_open_https_verifies_cert_against_hostname(monkeypatch):
    calls = {}
    monkeypatch.setattr(socket, 'create_connection', lambda addr, timeout: calls.setdefault('addr', addr) and 'raw')

    class FakeTLS:
        def wrap_socket(self, sock, server_hostname):
            calls['wrap'] = (sock, server_hostname)
            return 'tls'

    monkeypatch.setattr(extract, 'TLS', FakeTLS())
    conn = extract._open(extract.urlsplit('https://news.example/'), 443, PUBLIC_V4, 5)
    assert calls == {'addr': (PUBLIC_V4, 443), 'wrap': ('raw', 'news.example')}
    assert conn.sock == 'tls'


def test_extract_full_tier():
    result = extract.extract(ARTICLE)
    assert result['tier'] == 'full'
    assert result['title'] == 'Real title'
    assert 'Paragraph 19' in result['text']


def test_extract_thin_page_falls_back_to_metadata():
    html = '<html><head><title>Paywalled</title><meta name="description" content="Subscribe"></head><body><p>Subscribe to read.</p></body></html>'
    assert extract.extract(html) == {'tier': 'metadata', 'title': 'Paywalled', 'description': 'Subscribe', 'text': None}


def test_extract_nothing_is_failed_not_dropped():
    assert extract.extract('') == {'tier': 'failed', 'reason': 'no_content'}


@pytest.fixture
def server(monkeypatch):
    monkeypatch.setenv('INTERNAL_TOKEN', 's3cret')
    monkeypatch.setattr(extract.handler, 'log_message', lambda *a: None)
    srv = ThreadingHTTPServer(('127.0.0.1', 0), extract.handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    def post(body, headers):
        conn = http.client.HTTPConnection('127.0.0.1', srv.server_address[1], timeout=5)
        conn.request('POST', '/', body=body, headers=headers)
        resp = conn.getresponse()
        out = resp.status, json.loads(resp.read())
        conn.close()
        return out

    yield post
    srv.shutdown()


AUTH = {'Authorization': 'Bearer s3cret'}


@pytest.mark.parametrize('headers', [{}, {'Authorization': 'Bearer wrong'}, {'Authorization': 's3cret'}])
def test_missing_or_wrong_token_is_401(server, headers):
    # No body: the handler never reads an unauthenticated one, and Windows resets
    # a socket closed with unread input before the client sees the response.
    assert server('', headers) == (401, {'error': 'unauthorized'})


def test_token_compared_in_constant_time(server, monkeypatch):
    calls = []
    real = hmac.compare_digest
    monkeypatch.setattr(hmac, 'compare_digest', lambda a, b: calls.append((a, b)) or real(a, b))
    assert server('', {'Authorization': 'Bearer wrong'})[0] == 401
    assert calls == [(b'Bearer wrong', b'Bearer s3cret')]


def test_unexpected_error_is_failed_without_detail(server, monkeypatch):
    def crash(url):
        raise RuntimeError('secret internals')

    monkeypatch.setattr(extract, 'fetch', crash)
    assert server(json.dumps({'url': 'http://example.com/'}), AUTH) == (200, {'tier': 'failed', 'reason': 'internal'})


def test_unset_server_token_rejects_everything(server, monkeypatch):
    monkeypatch.delenv('INTERNAL_TOKEN')
    assert server('', {'Authorization': 'Bearer '}) == (401, {'error': 'unauthorized'})


@pytest.mark.parametrize('body', ['', 'not json', '[]', '{}', '{"url": 5}'])
def test_bad_body_is_400(server, body):
    assert server(body, AUTH) == (400, {'error': 'bad_request'})


def test_oversized_body_is_400_unread(server):
    # Declared length alone must be refused, before any of the body is read.
    headers = {**AUTH, 'Content-Length': str(extract.MAX_BODY + 1)}
    assert server('', headers) == (400, {'error': 'bad_request'})


def test_blocked_url_reports_failed_tier(server):
    assert server(json.dumps({'url': 'http://169.254.169.254/'}), AUTH) == (200, {'tier': 'failed', 'reason': 'blocked_host'})


def test_success_returns_extraction(server, monkeypatch):
    monkeypatch.setattr(extract, 'fetch', lambda url: ARTICLE)
    status, body = server(json.dumps({'url': 'http://example.com/'}), AUTH)
    assert (status, body['tier'], body['title']) == (200, 'full', 'Real title')


@pytest.mark.parametrize(
    'content_type, ok',
    [
        ('text/html', True),
        ('text/plain', True),
        ('application/xhtml+xml', True),
        ('application/pdf', False),
        ('image/png', False),
        ('application/octet-stream', False),
        ('video/mp4', False),
    ],
)
def test_non_markup_content_type_rejected_before_body_read(monkeypatch, web, content_type, ok):
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'ct.example': [PUBLIC_V4]}))
    routes['ct.example'] = FakeResponse(200, b'<html><body>hi</body></html>', content_type=content_type)
    if ok:
        assert extract.fetch('http://ct.example/') == '<html><body>hi</body></html>'
    else:
        with pytest.raises(extract.Failed, match='unsupported_type'):
            extract.fetch('http://ct.example/')


def test_rejected_content_type_does_not_read_the_body(monkeypatch, web):
    # The point of the gate: a 5 MB PDF must not be pulled down first.
    routes, _ = web
    monkeypatch.setattr(socket, 'getaddrinfo', fake_dns({'pdf.example': [PUBLIC_V4]}))
    resp = FakeResponse(200, b'%PDF-1.7' + b'x' * 100000, content_type='application/pdf')
    reads = []
    inner = resp.read1
    resp.read1 = lambda n: (reads.append(n), inner(n))[1]
    routes['pdf.example'] = resp
    with pytest.raises(extract.Failed, match='unsupported_type'):
        extract.fetch('http://pdf.example/')
    assert reads == []


def test_socket_closed_when_tls_handshake_fails(monkeypatch):
    # _open owns the socket until http.client adopts it; a bad certificate is
    # routine and must not leak the fd.
    closed = []

    class FakeSock:
        def close(self):
            closed.append(True)

    monkeypatch.setattr(socket, 'create_connection', lambda addr, timeout: FakeSock())
    monkeypatch.setattr(
        extract.TLS, 'wrap_socket', lambda *a, **k: (_ for _ in ()).throw(ssl.SSLCertVerificationError('bad cert'))
    )
    parts = urlsplit('https://tls.example/')
    with pytest.raises(ssl.SSLError):
        extract._open(parts, 443, PUBLIC_V4, 5)
    assert closed == [True]


def test_socket_kept_when_tls_handshake_succeeds(monkeypatch):
    closed = []

    class FakeSock:
        def close(self):
            closed.append(True)

    monkeypatch.setattr(socket, 'create_connection', lambda addr, timeout: FakeSock())
    monkeypatch.setattr(extract.TLS, 'wrap_socket', lambda sock, **k: sock)
    parts = urlsplit('https://tls.example/')
    assert extract._open(parts, 443, PUBLIC_V4, 5).sock is not None
    assert closed == []
