import json
import os
import socket

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="N-Queens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

APP_VERSION = os.getenv("APP_VERSION", "v1")
POD_NAME = socket.gethostname()


@app.get("/health")
def health():
    return {"status": "ok", "version": APP_VERSION, "pod": POD_NAME}


@app.get("/nqueens")
def nqueens(n: int = 12):
    if n < 1 or n > 20:
        return {"error": "n must be between 1 and 20"}

    def generate():
        yield f"data: {json.dumps({'type': 'info', 'pod': POD_NAME, 'version': APP_VERSION})}\n\n"

        board = [-1] * n
        count = 0
        yield_every = max(1, n ** 3 // 100)

        def is_valid(row, col):
            for r in range(row):
                c = board[r]
                if c == col or abs(c - col) == abs(r - row):
                    return False
            return True

        def backtrack(row):
            nonlocal count
            if row == n:
                count += 1
                if n <= 12:
                    yield board[:]
                elif count % yield_every == 0:
                    yield None
                return
            for col in range(n):
                if is_valid(row, col):
                    board[row] = col
                    yield from backtrack(row + 1)
                    board[row] = -1

        for result in backtrack(0):
            if result is not None:
                yield f"data: {json.dumps({'type': 'solution', 'board': result, 'count': count})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'progress', 'count': count})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'total': count})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Pod-Name": POD_NAME,
        },
    )
