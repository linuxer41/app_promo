import http.server
import socketserver


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server(("", 8000), NoCacheHandler) as httpd:
        print("App promo:")
        print("  Resto:      http://localhost:8000/resto/v2.html")
        print("  FactuGest:  http://localhost:8000/facturgest/v2.html")
        print("  Mis Facturas: http://localhost:8000/misfacturas/present.html")
        print("(Ctrl+C para salir)")
        httpd.serve_forever()
