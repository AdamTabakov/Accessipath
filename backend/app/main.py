"""FastAPI application factory (port of the Express app assembly)."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from .api.auth import router as auth_router
from .api.routes import router as api_router
from .config import settings
from .core.errors import register_exception_handlers
from .core.headers import SecurityHeadersMiddleware
from .services.store import DataStore, create_store


def _lifespan(external_store: Optional[DataStore]):
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if external_store is not None:
            app.state.store = external_store
        else:
            app.state.store = await create_store()
        Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
        yield
        if external_store is None:
            store = getattr(app.state, "store", None)
            close = getattr(store, "close", None)
            if close is not None:
                await close()

    return lifespan


def create_app(store: Optional[DataStore] = None) -> FastAPI:
    app = FastAPI(
        title="AccessiPath API",
        version="1.0.0",
        lifespan=_lifespan(store),
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=500)

    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

    app.include_router(auth_router)
    app.include_router(api_router)

    register_exception_handlers(app)
    return app


app = create_app()


__all__ = ["app", "create_app"]