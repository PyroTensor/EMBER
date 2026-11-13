"""ASGI middleware.

* ``RequestIDMiddleware``: propagates X-Request-ID, adds Server-Timing, logs one access line.
* ``BodySizeLimitMiddleware``: rejects request bodies over ``MAX_REQUEST_BODY_BYTES`` with a 413 envelope.
"""

from __future__ import annotations

import json
import logging
import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.constants import MAX_REQUEST_BODY_BYTES
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


class BodySizeLimitMiddleware:
    """Reject request bodies larger than ``max_bytes``.

    A too-large ``Content-Length`` is answered right away. Bodies without one (chunked) are counted while the
    app reads them; going over raises a 413 ``HTTPException``, which the error handlers render as the usual
    ``{"error": ...}`` envelope.
    """

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_REQUEST_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    def _message(self) -> str:
        return f"Request body exceeds the {self.max_bytes} byte limit"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    declared = 0
                if declared > self.max_bytes:
                    await self._reject(send)
                    return
                break

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise HTTPException(status_code=413, detail=self._message())
            return message

        await self.app(scope, limited_receive, send)

    async def _reject(self, send: Send) -> None:
        body = json.dumps(
            {"error": {"code": "PAYLOAD_TOO_LARGE", "message": self._message(), "details": None}}
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
