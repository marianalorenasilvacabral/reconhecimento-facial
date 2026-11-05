"""API do sistema de reconhecimento de alunos.

Execute (dentro de backend/):  uvicorn main:app --reload
"""
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes import admin, alunos, celular, identificacoes, integracao_mobile
from services.reconhecimento import ReconhecimentoIndisponivel

app = FastAPI(title="Reconhecimento de Alunos", version="0.3.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(alunos.router)
app.include_router(identificacoes.router)
app.include_router(celular.router)
app.include_router(admin.router)
app.include_router(integracao_mobile.router)


@app.exception_handler(ReconhecimentoIndisponivel)
def reconhecimento_indisponivel(_: Request, erro: ReconhecimentoIndisponivel):
    return JSONResponse(status_code=503, content={"detail": str(erro)})


@app.get("/saude")
def saude():
    return {"status": "ok"}
