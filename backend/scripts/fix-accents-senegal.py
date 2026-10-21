"""
Restaure les accents des libellés du TEC du Sénégal (produits, régimes).

La sauvegarde de Soft Transit SaaS (satm) contient des libellés abîmés par un ancien changement d'encodage :
  - « é » en minuscules devient « ?? » (UTF-8 lu comme deux caractères), « è » devient « ?~ » ;
  - une lettre accentuée majuscule (É, À, È, Ç…) devient « ? » ;
  - l'apostrophe typographique devient « ? » (« D?eau ») et « à » isolé devient « ? » ;
  - les caractères de la norme ISO 646 français : « { » = é, « } » = è, « | » = ù, « [ » = ° (« N[S 0303.91 »).
La lettre exacte est retrouvée par le dictionnaire : pour chaque mot abîmé on essaie les lettres accentuées possibles et on garde
la graphie connue la plus fréquente. Le dictionnaire est composé du français courant (pyspellchecker) et des libellés bien accentués
de la base du Gabon (TEC CEMAC, mêmes désignations du Système harmonisé) et de la base du Sénégal. Les mots qu'aucun dictionnaire
ne reconnaît restent inchangés et sont listés pour relecture.

Usage : python scripts/fix-accents-senegal.py            (simulation : statistiques, exemples, mots non résolus)
        python scripts/fix-accents-senegal.py --appliquer (met à jour la base PG_DATABASE de backend/.env)
Prérequis : pip install pyspellchecker "psycopg[binary]"
"""
import bisect
import collections
import itertools
import re
import sys
from pathlib import Path

import psycopg
from spellchecker import SpellChecker

BACKEND = Path(__file__).resolve().parent.parent
BASE_VOCABULAIRE = 'softtransit_gabon'  # lecture seule : libellés du TEC du Gabon, correctement accentués
COLONNES = [('produits', 'idproduits', 'libelle'), ('regimedeclaration', 'idregimedeclaration', 'libelleregimedeclaration')]
VOCAB_SOURCES = COLONNES + [('rubriques', 'idrubriques', 'libellerubrique'), ('lieux', 'idlieux', 'nomlieu'), ('pays', 'idpays', 'nompays')]

MINUSCULES = 'éèêëàâäôöîïûùüçœ'
MAJUSCULES = 'ÉÈÊËÀÂÄÔÖÎÏÛÙÜÇŒ'
ELISION = set('cdjlmnst')
MOT = re.compile(r"[A-Za-zÀ-ÿŒœ?~{}|]+")


def load_env():
    env = {}
    for line in (BACKEND / '.env').read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    return env


def connexion(env, base):
    return psycopg.connect(host=env['PG_HOST'], port=env['PG_PORT'], user=env['PG_USER'], password=env['PG_PASSWORD'], dbname=base)


def construire_vocabulaire(env):
    vocab = collections.Counter()
    francais = SpellChecker(language='fr')
    for mot, freq in francais.word_frequency.dictionary.items():
        vocab[mot] = 1 + freq // 1000
    sources = [(env['PG_DATABASE'], 1), (BASE_VOCABULAIRE, 20)]  # le TEC du Gabon prime (mêmes désignations, bien accentuées)
    for base, poids in sources:
        try:
            conn = connexion(env, base)
        except psycopg.Error:
            continue
        with conn, conn.cursor() as cur:
            for table, _, col in VOCAB_SOURCES:
                cur.execute(f"SELECT {col} FROM {table} WHERE {col} IS NOT NULL")
                for (texte,) in cur.fetchall():
                    for m in MOT.finditer(texte):
                        mot = m.group(0)
                        if not re.search(r'[?~{}|]', mot):
                            vocab[mot.lower()] += poids
    return vocab


def options_run(longueur, apostrophe, accents):
    """Remplacements possibles d'une suite de « ? » de cette longueur (apostrophe : le mot commence par une lettre d'élision)."""
    opts = []
    if longueur == 1:
        opts += list(accents)
        if apostrophe:
            opts.append("'")
    elif longueur == 2:
        opts += list(accents)
    elif longueur == 3:
        opts += list(accents)  # accent + caractère parasite
        if apostrophe:
            opts += ["'" + a for a in accents]
    elif longueur == 4:
        opts += [a + b for a in accents for b in accents]
    return opts


DEVINES = {}  # mot abîmé -> graphie choisie par règle (mot absent du dictionnaire), à relire

MANUEL = {  # formes que le dictionnaire ne peut pas deviner (lettre perdue, mots collés, symbole)
    's??rete': 'sûreté', 's??reteet': 'sûreté et', 'CM??': 'CM³', 'CM??MAIS': 'CM³ MAIS',
    'A?': 'À', 'BIS?': 'BIS', 'FRACTIONS?': 'FRACTIONS', 'M??E': 'MÊME', '??c??t??s': 'écôtés', 'Est?rs': 'Esters',
    'POIN?NNER': 'POINÇONNER', 'TRA??GE': 'TRAÇAGE', 'UNEPI?CE': 'UNE PIÈCE', '?PICIA': 'ÉPICÉA',
    'CORTICOST?RO?DES': 'CORTICOSTÉROÏDES', 'iod?sdes': 'iodés des', 'ol?oducsou': 'oléoducs ou', 'plusdestin??s': 'plus destinés',
    'grassesv??g??tales': 'grasses végétales', 'ecro??te': 'écroûte', 'invertebr??s': 'invertébrés', 'd?hydromassage': "d'hydromassage",
    'Sup??rieur??excellence??grade': 'Supérieur excellence grade', '??bromotrifluorom??thane??et': ' bromotrifluorométhane et',
}


def prefixe_connu(cand, mots_tries):
    """Vrai si un mot du dictionnaire commence par cand (libellés tronqués à la longueur de la colonne source)."""
    i = bisect.bisect_left(mots_tries, cand)
    return i < len(mots_tries) and mots_tries[i].startswith(cand)


def resoudre_mot(mot, vocab, mots_tries, majuscule_libelle):
    """Renvoie la graphie restaurée de ce mot, ou None s'il reste inconnu."""
    mot0 = mot
    en_majuscules = not re.search(r'[a-zàâäçéèêëîïôöùûüœ]', mot)
    mot = mot.replace('{', 'É' if en_majuscules else 'é').replace('}', 'È' if en_majuscules else 'è').replace('|', 'Ù' if en_majuscules else 'ù')
    if not re.search(r'[?~]', mot):
        return mot
    if mot in MANUEL:
        return MANUEL[mot]
    majuscule = not re.search(r'[a-zàâäçéèêëîïôöùûüœ]', mot)
    if re.fullmatch(r'\?{1,2}', mot):  # préposition « à » isolée (« ? » ou « ?? » selon l'encodage)
        return 'À' if majuscule_libelle else 'à'
    accents = MAJUSCULES if majuscule else MINUSCULES
    mot = re.sub(r'\?~', 'È' if majuscule else 'è', mot)
    if '?' not in mot:
        return mot
    morceaux = re.split(r'(\?+)', mot)
    apostrophe = len(morceaux[0]) == 1 and morceaux[0].lower() in ELISION or morceaux[0].lower() == 'qu'
    listes = []
    for i, p in enumerate(morceaux):
        if p and p[0] == '?':
            opts = options_run(len(p), apostrophe and i == 1, accents)
            if not opts:
                return None
            listes.append(opts)
        else:
            listes.append([p])
    candidats = [''.join(c) for c in itertools.product(*listes)]
    meilleur, score = None, 0
    for cand in candidats:
        cle = cand.lower().split("'")[-1] if "'" in cand else cand.lower()
        sc = vocab.get(cle, 0) if ("'" not in cand or len(cle) >= 3) else 0
        if sc > score:
            meilleur, score = cand, sc
    if meilleur:
        return meilleur
    # mot tronqué (colonne source limitée) : un mot du dictionnaire commence-t-il ainsi ?
    for cand in sorted(candidats, key=lambda c: -len(c)):
        cle = cand.lower().split("'")[-1] if "'" in cand else cand.lower()
        if len(cle) >= 4 and prefixe_connu(cle, mots_tries):
            DEVINES[mot0] = cand
            return cand
    # mot technique inconnu (chimie…) : « -ène » (benzène, phosgène) sinon « é »
    fin = None
    if len(morceaux) == 3 and len(morceaux[1]) == 1 and morceaux[0][-1:].lower() not in 'aeiouy':
        if re.fullmatch(r'NES?|RES?', morceaux[2], re.I):  # -ène (benzène), -ère (copolymères)
            fin = 'È' if majuscule else 'è'
    if apostrophe and len(morceaux) == 3 and morceaux[1] == '?' and morceaux[2][:1].lower() in 'aeiouh':
        DEVINES[mot0] = morceaux[0] + "'" + morceaux[2]
        return DEVINES[mot0]
    choix = []
    for i, p in enumerate(morceaux):
        if p and p[0] == '?':
            choix.append(('' if len(p) > 1 and False else '') + (fin if (fin and i == 1) else ('É' if majuscule else 'é')))
        else:
            choix.append(p)
    DEVINES[mot0] = ''.join(choix)
    return DEVINES[mot0]


def restaurer(texte, vocab, mots_tries, inconnus):
    texte = texte.replace('?[', '°').replace('[', '°').replace('POIN+ONNER', 'POINÇONNER')  # « ° » : 0xC2 0xB0 lu en ISO 646 français
    texte = texte.replace('?·', '°')
    texte = re.sub(r'(?<![A-Za-z])\?{3,4}([A-Za-z]+)\?{3,4}(?![A-Za-z])', r'"\1"', texte)  # guillemets typographiques
    texte = re.sub(r'(?<=[A-Za-z0-9°])\?\?(?=\d)|(?<=\d)\?\?(?=[A-Za-z]{1,3}\b)', ' ', texte)  # espace insécable (35??mm, Note??2)
    lettres = [c for c in texte if c.isalpha()]
    majuscule_libelle = bool(lettres) and sum(c.isupper() for c in lettres) > len(lettres) / 2

    def remplace(m):
        mot = m.group(0)
        r = resoudre_mot(mot, vocab, mots_tries, majuscule_libelle)
        if r is None or '?' in r:
            inconnus[mot] += 1
            return mot
        return r
    return MOT.sub(remplace, texte)


def main():
    appliquer = '--appliquer' in sys.argv
    env = load_env()
    vocab = construire_vocabulaire(env)
    mots_tries = sorted(vocab)
    inconnus = collections.Counter()
    conn = connexion(env, env['PG_DATABASE'])
    total = 0
    modif = []
    with conn, conn.cursor() as cur:
        for table, pk, col in COLONNES:
            cur.execute(f"SELECT {pk}, {col} FROM {table} WHERE {col} ~ '[?~{{}}|\\[]'")
            lignes = cur.fetchall()
            total += len(lignes)
            for ident, libelle in lignes:
                nouveau = restaurer(libelle, vocab, mots_tries, inconnus)
                if nouveau != libelle:
                    modif.append((table, pk, col, ident, libelle, nouveau))
        restants = sum(1 for m in modif if '?' in m[5])
        print(f'Libellés abîmés : {total} ; modifiés : {len(modif)} ; encore avec « ? » : {restants}')
        print(f'Mots non résolus : {len(inconnus)} formes distinctes ; mots devinés par règle (absents du dictionnaire) : {len(DEVINES)}')
        for mot, r in sorted(DEVINES.items()):
            print(f'   devine  {mot}  ->  {r}')
        for mot, n in inconnus.most_common(80):
            print(f'   {mot}  ({n})')
        print('--- exemples')
        for t, _, _, i, avant, apres in modif[:: max(1, len(modif) // 25)][:25]:
            print(f'   {avant[:90]}\n   -> {apres[:90]}')
        if appliquer:
            for table, pk, col, ident, _, apres in modif:
                cur.execute(f'UPDATE {table} SET {col} = %s WHERE {pk} = %s', (apres, ident))
            print(f'{len(modif)} libellés mis à jour dans {env["PG_DATABASE"]}')
        else:
            conn.rollback()
            print('(simulation : rien n\'a été modifié ; ajouter --appliquer)')


if __name__ == '__main__':
    main()
