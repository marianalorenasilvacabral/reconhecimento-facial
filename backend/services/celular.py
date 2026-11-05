"""Sessões do modo celular: o celular envia quadros e o computador os consulta.

Tudo fica só na memória do servidor (some ao reiniciar a API). Guardamos apenas o ÚLTIMO
quadro de cada sessão, para o computador exibi-lo; ele é substituído a cada novo quadro
e a sessão expira sozinha depois de alguns minutos sem uso.
"""
import secrets
import socket
import threading
import time
from dataclasses import dataclass, field, replace

TEMPO_OCIOSO_S = 15 * 60  # a sessão expira depois de 15 minutos sem receber quadros
MAXIMO_SESSOES = 5
CONECTADO_ATE_S = 4.0  # sem quadros há mais que isto = celular desconectado


@dataclass
class SessaoCelular:
    token: str
    ultima_atividade: float = field(default_factory=time.monotonic)
    ultimo_quadro_em: float | None = None
    numero_quadro: int = 0
    jpeg: bytes | None = None
    resultado: dict | None = None


class RegistroCelular:
    def __init__(self) -> None:
        self._trava = threading.Lock()
        self._sessoes: dict[str, SessaoCelular] = {}

    def _limpar(self) -> None:
        agora = time.monotonic()
        for token in [t for t, s in self._sessoes.items() if agora - s.ultima_atividade > TEMPO_OCIOSO_S]:
            del self._sessoes[token]

    def criar(self) -> SessaoCelular:
        with self._trava:
            self._limpar()
            while len(self._sessoes) >= MAXIMO_SESSOES:
                mais_antiga = min(self._sessoes.values(), key=lambda s: s.ultima_atividade)
                del self._sessoes[mais_antiga.token]
            sessao = SessaoCelular(token=secrets.token_urlsafe(16))
            self._sessoes[sessao.token] = sessao
            return sessao

    def obter(self, token: str) -> SessaoCelular | None:
        with self._trava:
            self._limpar()
            sessao = self._sessoes.get(token)
            return replace(sessao) if sessao else None

    def atualizar(self, token: str, jpeg: bytes, resultado: dict) -> bool:
        with self._trava:
            self._limpar()
            sessao = self._sessoes.get(token)
            if sessao is None:
                return False
            agora = time.monotonic()
            sessao.ultima_atividade = agora
            sessao.ultimo_quadro_em = agora
            sessao.numero_quadro += 1
            sessao.jpeg = jpeg
            sessao.resultado = resultado
            return True

    def encerrar(self, token: str) -> None:
        with self._trava:
            self._sessoes.pop(token, None)

    def remover_aluno(self, aluno_id: int) -> None:
        """Descarta a imagem e o cartão em memória associados a um cadastro excluído."""
        with self._trava:
            for sessao in self._sessoes.values():
                aluno = (sessao.resultado or {}).get('aluno') or {}
                if aluno.get('id') == aluno_id:
                    sessao.jpeg = None
                    sessao.resultado = None
                    sessao.ultimo_quadro_em = None
                    sessao.numero_quadro += 1

    def limpar_tudo(self) -> None:
        with self._trava:
            self._sessoes.clear()


registro = RegistroCelular()


def enderecos_da_rede_local() -> list[str]:
    """Endereços IPv4 deste computador na rede (o celular precisa de um deles para chegar aqui)."""
    achados: list[str] = []
    try:  # descobre a interface da rota padrão; não envia nenhum pacote
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            achados.append(s.getsockname()[0])
    except OSError:
        pass
    try:
        achados.extend(socket.gethostbyname_ex(socket.gethostname())[2])
    except OSError:
        pass
    unicos: list[str] = []
    for ip in achados:
        if not ip.startswith("127.") and ip not in unicos:
            unicos.append(ip)
    return unicos
