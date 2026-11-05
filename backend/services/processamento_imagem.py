"""Verificação das imagens recebidas.

O tipo é descoberto pelo CONTEÚDO do arquivo (os primeiros bytes), e não pelo nome ou pelo
tipo que o navegador informou, que podem ser falsos. Esta etapa não decodifica a imagem;
verificações de qualidade e de rosto detectável entram na Etapa 4.
"""

TAMANHO_MAX_BYTES = 5 * 1024 * 1024

_ASSINATURAS = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
}


class ImagemInvalida(ValueError):
    """O arquivo recebido não é uma imagem aceita."""


def validar_imagem(conteudo: bytes) -> str:
    """Devolve o tipo MIME real (image/jpeg ou image/png) ou levanta ImagemInvalida."""
    if not conteudo:
        raise ImagemInvalida("o arquivo está vazio.")
    if len(conteudo) > TAMANHO_MAX_BYTES:
        raise ImagemInvalida("o arquivo é maior que 5 MB.")
    for tipo, assinatura in _ASSINATURAS.items():
        if conteudo.startswith(assinatura):
            return tipo
    raise ImagemInvalida("o arquivo não é uma imagem JPG ou PNG válida.")
