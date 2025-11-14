from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request

from .config import get_settings
from .models import RasSnapshot
from .ras_client import collect_snapshot

app = FastAPI(title="1C RAS Monitor", version="1.0.0")

templates = Jinja2Templates(directory="frontend")
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/snapshot", response_model=RasSnapshot)
async def snapshot() -> RasSnapshot:
    return collect_snapshot()


@app.get("/api/settings")
async def settings():
    return get_settings()
