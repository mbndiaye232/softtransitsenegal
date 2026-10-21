"""
Import du TEC du Sénégal depuis une sauvegarde MySQL de Soft Transit SaaS (satm) vers PostgreSQL :
produits, taxes (avec niveau de calcul), taux, tarifs, compléments de taxes, régimes de déclaration et rubriques.

Source : backup_clean.sql (sauvegarde du 2026-05-11, à la racine du projet) ; autre fichier possible en argument.
Les identifiants de la sauvegarde sont conservés (tarifs relie produits, taxes et taux par IDProduits / IDTaxes / IDTaux).
Les doublons exacts de tarifs (même NTS + CodeTaux + CodeTaxe) sont écartés, comme pour le TEC du Gabon.

Les tables cibles sont VIDÉES puis remplies (les tables métier qui les référencent sont vides sur une base neuve).
Le classement des régimes (définitif / suspensif / exonération) est fait à part : migrations-pg/008_classification_regimes_senegal.sql.

Prérequis : pip install "psycopg[binary]"
Usage     : python scripts/import-tec-senegal.py [chemin/vers/sauvegarde.sql]
"""
import re
import sys
from pathlib import Path

import psycopg

BACKEND = Path(__file__).resolve().parent.parent
SAUVEGARDE = Path(sys.argv[1]) if len(sys.argv) > 1 else BACKEND.parent / 'backup_clean.sql'

# table MySQL -> table PostgreSQL (mêmes noms en minuscules)
TABLES = ['produits', 'taxes', 'taux', 'tarifs', 'taxes_complements', 'regimedeclaration', 'rubriques']
ESC = {'n': '\n', 'r': '\r', 't': '\t', '0': '\0', 'Z': '\x1a', 'b': '\b'}


# Caractères de contrôle présents dans certains libellés de la source (ex. 0x1A, qui interrompt la lecture sous Windows)
CONTROLE = re.compile('[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')


def load_env():
    env = {}
    for line in (BACKEND / '.env').read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    return env


def colonnes(sql, table):
    m = re.search(r'CREATE TABLE `%s` \((.*?)\n\) ENGINE' % table, sql, re.S)
    return [c.lower() for c in re.findall(r'^\s*`([^`]+)`', m.group(1), re.M)]


def lignes(sql, table):
    """Parcourt les INSERT ... VALUES (...),(...); d'une table et renvoie des tuples Python."""
    for m in re.finditer(r'INSERT INTO `%s` VALUES ' % table, sql):
        i, n = m.end(), len(sql)
        while i < n:
            if sql[i] != '(':
                break
            i += 1
            row = []
            while True:
                c = sql[i]
                if c == "'":
                    i += 1
                    buf = []
                    while True:
                        c = sql[i]
                        if c == '\\':
                            i += 1
                            buf.append(ESC.get(sql[i], sql[i]))
                        elif c == "'":
                            if sql[i + 1] == "'":
                                buf.append("'")
                                i += 1
                            else:
                                break
                        else:
                            buf.append(c)
                        i += 1
                    i += 1
                    row.append(CONTROLE.sub('', ''.join(buf)))
                else:
                    j = i
                    while sql[j] not in ',)':
                        j += 1
                    tok = sql[i:j]
                    i = j
                    row.append(None if tok == 'NULL' else (float(tok) if re.search(r'[.eE]', tok) else int(tok)))
                if sql[i] == ',':
                    i += 1
                    continue
                i += 1  # ')'
                break
            yield tuple(row)
            if sql[i] == ',':
                i += 1
            else:
                break  # ';'


def main():
    e = load_env()
    sql = SAUVEGARDE.read_text(encoding='utf-8', errors='replace')
    data = {}
    for t in TABLES:
        cols = colonnes(sql, t)
        rows = list(lignes(sql, t))
        assert all(len(r) == len(cols) for r in rows), f'{t} : nombre de colonnes incohérent'
        data[t] = (cols, rows)

    cols, rows = data['tarifs']
    i_nts, i_taux, i_taxe, i_id = cols.index('nts'), cols.index('codetaux'), cols.index('codetaxe'), cols.index('idtarifs')
    avant = len(rows)
    vus, uniques = set(), []
    for r in sorted(rows, key=lambda r: r[i_id]):
        k = (r[i_nts], r[i_taux], r[i_taxe])
        if k not in vus:
            vus.add(k)
            uniques.append(r)
    data['tarifs'] = (cols, uniques)
    print(f'Tarifs : {avant} lignes, {avant - len(uniques)} doublons écartés')
    suspects = sum(1 for t in TABLES for r in data[t][1] for v in r if isinstance(v, str) and '�' in v)
    print(f'Caractères illisibles (U+FFFD) dans les données : {suspects}')

    conn = psycopg.connect(host=e['PG_HOST'], port=e['PG_PORT'], user=e['PG_USER'], password=e['PG_PASSWORD'], dbname=e['PG_DATABASE'])
    with conn, conn.cursor() as cur:
        cur.execute('TRUNCATE ' + ', '.join(TABLES) + ' RESTART IDENTITY CASCADE')
        for t in TABLES:
            cols, rows = data[t]
            cur.executemany(
                f'INSERT INTO {t} ({", ".join(cols)}) VALUES ({", ".join(["%s"] * len(cols))})', rows)
            pk = cols[0]
            cur.execute(f"SELECT setval(pg_get_serial_sequence('{t}', '{pk}'), COALESCE((SELECT MAX({pk}) FROM {t}), 1))")
            print(f'{t:20s} {len(rows):6d} lignes')
    print(f'Base {e["PG_DATABASE"]} : TEC du Sénégal chargé depuis {SAUVEGARDE.name}')


if __name__ == '__main__':
    main()
