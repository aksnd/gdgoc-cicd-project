import asyncio
import json
import os
import socket

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="Sieve of Eratosthenes API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

APP_VERSION = os.getenv("APP_VERSION", "v1")
POD_NAME = socket.gethostname()

# v2: 미리 알고 있는 소수 — 이 범위는 계산 없이 즉시 처리
CACHED_PRIMES = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47}


@app.get("/health")
def health():
    return {"status": "ok", "version": APP_VERSION, "pod": POD_NAME}


@app.get("/sieve")
async def sieve(request: Request, n: int = 200):
    if n < 2:
        return {"error": "n must be at least 2"}

    async def generate():
        try:
            yield f"data: {json.dumps({'type': 'info', 'pod': POD_NAME, 'version': APP_VERSION})}\n\n"

            is_prime = [True] * (n + 1)
            is_prime[0] = is_prime[1] = False

            for i in range(2, int(n ** 0.5) + 1):
                if await request.is_disconnected():
                    break

                if not is_prime[i]:
                    continue

                marked = []
                for j in range(i * i, n + 1, i):
                    if is_prime[j]:
                        is_prime[j] = False
                        marked.append(j)

                yield f"data: {json.dumps({'type': 'step', 'prime': i, 'marked': marked})}\n\n"

                # v2: 캐시된 소수는 딜레이 없이 즉시 처리
                delay = 0.1 if (APP_VERSION == "v2" and i in CACHED_PRIMES) else 0.5
                await asyncio.sleep(delay)

            if not await request.is_disconnected():
                primes = [i for i, v in enumerate(is_prime) if v]
                yield f"data: {json.dumps({'type': 'done', 'primes': primes})}\n\n"

        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Pod-Name": POD_NAME,
        },
    )
