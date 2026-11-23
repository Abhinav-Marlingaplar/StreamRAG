from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.auth import router as auth_router
from .routers.events import router as events_router
from .routers.query import router as query_router
from .routers.simulator import router as simulator_router
from .routers.status import router as status_router
from .routers.timeline import router as timeline_router


app = FastAPI(title="StreamRAG API")
app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(timeline_router)
app.include_router(events_router)
app.include_router(status_router)
app.include_router(simulator_router)
app.include_router(query_router)
