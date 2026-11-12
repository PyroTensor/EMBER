"""Request-id middleware: propagates X-Request-ID, adds Server-Timing, logs one access line."""

from __future__ import annotations

import logging
import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import request_id_var

REQUEST_ID_HEADER = "X-Request-ID"

access_logger = logging.getLogger("ember.access")


class RequestIDMiddleware:
    """Pure ASGI middleware (keeps the ContextVar visible to handlers and error handlers)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = None
        for name, value in scope.get("headers", []):
            if name == b"x-request-id":
                incoming = value.decode("latin-1").strip()
                break
        request_id = incoming[:128] if incoming else uuid.uuid4().hex

        token = request_id_var.set(request_id)
        start = time.perf_counter()
        status_code = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                dur_ms = (time.perf_counter() - start) * 1000
                headers = MutableHeaders(scope=message)
                headers[REQUEST_ID_HEADER] = request_id
                headers.append("Server-Timing", f"app;dur={dur_ms:.1f}")
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            dur_ms = (time.perf_counter() - start) * 1000
            access_logger.info("%s %s %d %.1fms", scope["method"], scope["path"], status_code, dur_ms)
            request_id_var.reset(token)
