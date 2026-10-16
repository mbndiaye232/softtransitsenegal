"""
Import des régimes SYDONIA du Gabon (TEC/RégimesOK.xlsx) dans regimedeclaration.

Colonnes : SYDONIA -> coderegimedeclaration, LIBELLE -> libelleregimedeclaration,
CODE ADDITIONNEL -> code_additionnel, regime = 3 premiers caractères du code SYDONIA.
Sont écartés : la ligne « FIN », les lignes titres (sans code additionnel ou « Retour au début »)
et les doublons exacts (même code + libellé + code additionnel).
Prérequis : migration 004 appliquée ; pip install openpyxl "psycopg[binary]"
Remplace tout le contenu de regimedeclaration, dans une seule transaction.
"""
from pathlib import Path

import openpyxl
import psycopg

BACKEND = Path(__file__).resolve().parent.parent
XLSX = BACKEND.parent / 'TEC' / 'RégimesOK.xlsx'


def load_env():
    env = {}
    for line in (BACKEND / '.env').read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    return env


def norm(v):
    return ' '.join(str(v).replace('\xa0', ' ').split()) if v is not None else ''


def main():
    e = load_env()
    ws = openpyxl.load_workbook(XLSX, data_only=True).active
    rows, vus, titres, doublons = [], set(), 0, 0
    for libelle, code, add in list(ws.iter_rows(values_only=True))[1:]:
        libelle, code, add = norm(libelle), norm(code), norm(add)
        if not code or libelle == 'FIN':
            continue
        if not add or add.lower().startswith('retour au'):
            titres += 1
            continue
        cle = (code, libelle, add)
        if cle in vus:
            doublons += 1
            continue
        vus.add(cle)
        rows.append((code, libelle, add, code[:3]))
    print(f"{len(rows)} régimes ; {titres} lignes titres et {doublons} doublon(s) écartés")

    conn = psycopg.connect(host=e['PG_HOST'], port=e['PG_PORT'], user=e['PG_USER'],
                           password=e['PG_PASSWORD'], dbname=e['PG_DATABASE'])
    print(f"Base cible : {e['PG_DATABASE']}")
    with conn, conn.cursor() as cur:
        cur.execute('DELETE FROM regimedeclaration')
        cur.executemany(
            'INSERT INTO regimedeclaration (coderegimedeclaration, libelleregimedeclaration, code_additionnel, regime) '
            'VALUES (%s,%s,%s,%s)', rows)
        cur.execute("SELECT setval(pg_get_serial_sequence('regimedeclaration','idregimedeclaration'), "
                    "(SELECT MAX(idregimedeclaration) FROM regimedeclaration))")
    print('Import terminé (transaction validée).')


if __name__ == '__main__':
    main()
