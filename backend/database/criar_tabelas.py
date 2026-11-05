"""Cria as tabelas no banco indicado em DATABASE_URL.

Uso (dentro de backend/):  python -m database.criar_tabelas
É seguro rodar mais de uma vez: tabelas existentes não são apagadas.
"""
from pathlib import Path

from sqlalchemy import text

from .conexao import obter_engine


def main() -> None:
    sql = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
    engine = obter_engine()
    # exec_driver_sql envia o script inteiro (várias instruções e função PL/pgSQL) ao driver.
    with engine.begin() as conexao:
        conexao.exec_driver_sql(sql.replace("BEGIN;", "").replace("COMMIT;", ""))
        tabelas = conexao.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' ORDER BY table_name"
            )
        ).scalars().all()
    print("Tabelas no banco:", ", ".join(tabelas))


if __name__ == "__main__":
    main()
