#!/usr/bin/env python3
"""
enrich_pos.py — Pulls 詞性 (part-of-speech) from the tableConvert CSVs into
processed_vocabulary.json.

Matching strategy (in priority order):
  1. Exact term + exact reading
  2. Exact term + reading is '-' in CSV (katakana/unlisted reading)
  3. Exact term only (last resort)

Mapping of Chinese 詞性 → English pos enum:
  動詞        → verb
  ナ形容詞    → na_adj
  イ形容詞    → i_adj
  名詞        → noun
  副詞        → adverb
  代名詞      → pronoun
  感嘆詞      → interjection
  連接詞      → conjunction
  連體詞      → pre_noun
  量詞        → counter
  前綴        → prefix
  後綴        → suffix
  句子        → phrase
  詞組        → phrase
  (anything else) → other

The raw 詞性 Chinese string is also stored as `pos_raw` for full traceability.
"""

import csv
import json
from pathlib import Path
from collections import Counter

ASSETS = Path(__file__).parent / "src" / "assets"

POS_MAP = {
    "動詞":     "verb",
    "ナ形容詞": "na_adj",
    "イ形容詞": "i_adj",
    "名詞":     "noun",
    "副詞":     "adverb",
    "代名詞":   "pronoun",
    "感嘆詞":   "interjection",
    "連接詞":   "conjunction",
    "連體詞":   "pre_noun",
    "量詞":     "counter",
    "前綴":     "prefix",
    "後綴":     "suffix",
    "句子":     "phrase",
    "詞組":     "phrase",
}

# Term column aliases (strip BOM + whitespace)
TERM_ALIASES = {"term", "單字", "單　　字"}
READING_ALIASES = {"reading", "讀音", "讀　　音"}


def normalize_header_cell(s):
    """Strip BOM, ideographic spaces, regular spaces."""
    return s.lstrip("\ufeff").replace("\u3000", "").replace(" ", "").replace("\n", "").strip()


def load_tableconvert(path: Path):
    """
    Returns a list of dicts with keys: term, reading, pos_raw.
    """
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        rows = list(reader)

    # Header is always row 0
    header = [normalize_header_cell(h) for h in rows[0]]

    term_col = reading_col = pos_col = None
    for i, h in enumerate(header):
        if h in TERM_ALIASES:
            term_col = i
        if h in READING_ALIASES:
            reading_col = i
        if "詞性" in h:
            pos_col = i

    if term_col is None or reading_col is None or pos_col is None:
        raise ValueError(
            f"Could not find required columns in {path}.\n"
            f"  Normalized header: {header}\n"
            f"  term_col={term_col}, reading_col={reading_col}, pos_col={pos_col}"
        )

    entries = []
    for row in rows[1:]:  # skip header
        if len(row) <= max(term_col, reading_col, pos_col):
            continue
        term = row[term_col].strip()
        reading = row[reading_col].strip()
        pos_raw = row[pos_col].strip()
        if not term or not pos_raw:
            continue
        entries.append({"term": term, "reading": reading, "pos_raw": pos_raw})

    return entries


def build_lookup(entries):
    """
    Build lookup dicts for fast matching.
    """
    exact = {}       # (term, reading) → pos_raw
    by_term = {}     # term → list of pos_raw (for fallback)
    dash_reading = {}  # term → pos_raw where reading == '-'

    for e in entries:
        t, r, p = e["term"], e["reading"], e["pos_raw"]
        if not p:
            continue
        key = (t, r)
        if key not in exact:   # first file wins
            exact[key] = p
        by_term.setdefault(t, []).append(p)
        if r in ("-", "") and t not in dash_reading:
            dash_reading[t] = p

    return exact, by_term, dash_reading


def resolve_pos(term, reading, exact, by_term, dash_reading):
    """Try all match strategies; return (pos_raw, matched_by) or (None, None)."""
    if (term, reading) in exact:
        return exact[(term, reading)], "exact"
    if term in dash_reading:
        return dash_reading[term], "dash_reading"
    if term in by_term:
        vals = by_term[term]
        return vals[0], f"term_only{'_ambig' if len(vals) > 1 else ''}"
    return None, None


def main():
    csv_files = [
        ASSETS / "tableConvert.com_a6dmmb.csv",
        ASSETS / "tableConvert.com_3g7nvc.csv",
    ]

    all_entries = []
    for p in csv_files:
        entries = load_tableconvert(p)
        print(f"Loaded {len(entries)} entries from {p.name}")
        all_entries.extend(entries)

    exact, by_term, dash_reading = build_lookup(all_entries)

    json_path = ASSETS / "processed_vocabulary.json"
    with open(json_path, encoding="utf-8") as f:
        vocab = json.load(f)

    matched = 0
    unmatched_terms = []

    for entry in vocab:
        term = entry.get("term", "").strip()
        reading = entry.get("reading", "").strip()

        pos_raw, how = resolve_pos(term, reading, exact, by_term, dash_reading)

        if pos_raw:
            entry["pos_raw"] = pos_raw
            entry["pos"] = POS_MAP.get(pos_raw, "other")
            matched += 1
        else:
            # Fallback heuristics
            affix = entry.get("affix_type", "none")
            if entry.get("dic_form"):
                entry["pos_raw"] = "動詞"
                entry["pos"] = "verb"
                matched += 1
            elif affix == "prefix":
                entry["pos_raw"] = "前綴"
                entry["pos"] = "prefix"
                matched += 1
            elif affix == "suffix":
                entry["pos_raw"] = "後綴"
                entry["pos"] = "suffix"
                matched += 1
            else:
                entry["pos_raw"] = ""
                entry["pos"] = "other"
                unmatched_terms.append(term)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)

    total = len(vocab)
    print(f"\nDone. {matched}/{total} entries matched.")
    if unmatched_terms:
        print(f"Unmatched ({len(unmatched_terms)}):")
        for t in unmatched_terms:
            print(f"  {t}")

    dist = Counter(e.get("pos", "other") for e in vocab)
    print("\npos distribution:")
    for pos, count in sorted(dist.items(), key=lambda x: -x[1]):
        print(f"  {pos:20s} {count}")


if __name__ == "__main__":
    main()
