"""
Import du TEC Gabon (dossier TEC/*.xlsx) dans PostgreSQL : produits, taxes, taux, tarifs.

Les identifiants des feuilles Excel sont conservés : tarifs relie produits, taxes et taux
par IDProduits / IDTaxes / IDTaux. Les lignes sans NTS (marqueur de fin « FIN » de l'export)
et les doublons exacts de tarifs (même NTS + CodeTaux + CodeTaxe) sont écartés.

Les 4 tables doivent être vides au départ (le script refuse de s'exécuter sinon).
Prérequis : pip install pandas openpyxl "psycopg[binary]"
Usage     : python scripts/import-tec-gabon.py
"""
from pathlib import Path

import pandas as pd
import psycopg

BACKEND = Path(__file__).resolve().parent.parent
TEC = BACKEND.parent / 'TEC'


def load_env():
    env = {}
    for line in (BACKEND / '.env').read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    return env


def clean(v):
    return None if pd.isna(v) else v


def main():
    e = load_env()
    P = pd.read_excel(TEC / 'Produits.xlsx', dtype={'NTS': str})
    X = pd.read_excel(TEC / 'taxes.xlsx', dtype={'CodeTaxe': str})
    T = pd.read_excel(TEC / 'taux.xlsx')
    R = pd.read_excel(TEC / 'tarifs.xlsx', dtype={'NTS': str, 'CodeTaxe': str})

    sans_nts = P[P.NTS.isna()]
    P = P[P.NTS.notna()]
    R = R[R.IDProduits.isin(P.IDProduits)]
    avant = len(R)
    R = R.sort_values('IDTarifs').drop_duplicates(['NTS', 'CodeTaux', 'CodeTaxe'])
    print(f"Produits sans NTS écartés : {len(sans_nts)} ; doublons de tarifs écartés : {avant - len(R)}")

    conn = psycopg.connect(
        host=e['PG_HOST'], port=e['PG_PORT'], user=e['PG_USER'],
        password=e['PG_PASSWORD'], dbname=e['PG_DATABASE'],
    )
    print(f"Base cible : {e['PG_DATABASE']}")
    with conn, conn.cursor() as cur:
        for table in ('tarifs', 'produits', 'taxes', 'taux'):
            cur.execute(f'SELECT count(*) FROM {table}')
            if cur.fetchone()[0]:
                raise SystemExit(f'La table {table} n\'est pas vide : arrêt sans rien modifier.')

        cur.executemany(
            'INSERT INTO taxes (idtaxes, codetaxe, libelletaxe, libelletaxecomplet, idagent, niveau, base) '
            'OVERRIDING SYSTEM VALUE VALUES (%s,%s,%s,%s,%s,%s,%s)',
            [(int(r.IDTaxes), r.CodeTaxe, r.LibelleTaxe, clean(r.LibelleTaxeComplet) or '',
              int(r.IdAgent), int(r.Niveau), clean(r.Base) or 'V') for r in X.itertuples()])
        cur.executemany(
            'INSERT INTO taux (idtaux, codetaux, taux, idagent) OVERRIDING SYSTEM VALUE VALUES (%s,%s,%s,%s)',
            [(int(r.IDTaux), r.CodeTaux, float(r.Taux), int(r.IdAgent)) for r in T.itertuples()])
        cur.executemany(
            'INSERT INTO produits (idproduits, libelle, nts, idagents) OVERRIDING SYSTEM VALUE VALUES (%s,%s,%s,%s)',
            [(int(r.IDProduits), r.Libelle, r.NTS, int(r.IDAgents)) for r in P.itertuples()])
        cur.executemany(
            'INSERT INTO tarifs (idtarifs, nts, codetaux, codetaxe, idtaux, idtaxes, idproduits, idagent) '
            'OVERRIDING SYSTEM VALUE VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',
            [(int(r.IDTarifs), r.NTS, r.CodeTaux, r.CodeTaxe, int(r.IDTaux), int(r.IDTaxes),
              int(r.IDProduits), int(r.IdAgent)) for r in R.itertuples()])

        for table, col in [('taxes', 'idtaxes'), ('taux', 'idtaux'), ('produits', 'idproduits'), ('tarifs', 'idtarifs')]:
            cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), (SELECT MAX({col}) FROM {table}))")
    print('Import terminé (transaction validée).')


if __name__ == '__main__':
    main()
