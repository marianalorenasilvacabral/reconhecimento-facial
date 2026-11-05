"""Validações de dados pessoais feitas no servidor (a tela também valida, mas o servidor
nunca deve confiar apenas no que o navegador diz)."""
from datetime import date


def apenas_digitos(valor: str) -> str:
    return "".join(c for c in str(valor or "") if c.isdigit())


def cpf_valido(valor: str) -> bool:
    d = apenas_digitos(valor)
    if len(d) != 11 or len(set(d)) == 1:
        return False

    def digito(base: str) -> int:
        soma = sum(int(c) * (len(base) + 1 - i) for i, c in enumerate(base))
        resto = (soma * 10) % 11
        return 0 if resto == 10 else resto

    return digito(d[:9]) == int(d[9]) and digito(d[:10]) == int(d[10])


def mascarar_cpf(cpf: str) -> str:
    d = apenas_digitos(cpf)
    return f"***.***.***-{d[9:]}" if len(d) == 11 else "—"


def erro_no_nome(nome: str) -> str | None:
    limpo = " ".join(nome.split())
    if not limpo:
        return "Informe o nome completo."
    if " " not in limpo:
        return "Informe nome e sobrenome."
    if len(limpo) > 120:
        return "O nome pode ter no máximo 120 caracteres."
    if not limpo[0].isalpha() or not all(c.isalpha() or c in " '.-" for c in limpo):
        return "Use apenas letras, espaços, hífen, apóstrofo ou ponto no nome."
    return None


def erro_no_nascimento(nascimento: date) -> str | None:
    if nascimento > date.today():
        return "A data de nascimento não pode estar no futuro."
    if nascimento < date(1900, 1, 1):
        return "Data de nascimento muito antiga. Confira o ano."
    return None
