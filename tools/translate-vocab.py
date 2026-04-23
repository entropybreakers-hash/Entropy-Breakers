#!/usr/bin/env python3
"""
translate-vocab.py — add Hungarian translations to vocab example sentences.

For every `vocab-*.html` at the repo root, finds the `const CARDS = [...]`
array, and for each card that has `en` + `example` but no `exampleHu`,
calls the Claude API to translate the example sentence to Hungarian,
and rewrites the file with the new field inserted.

Idempotent: skips cards that already have `exampleHu`.

Requirements:
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...

Usage (from repo root):
    python3 tools/translate-vocab.py              # translate all
    python3 tools/translate-vocab.py vocab-a2-family-relationships.html
    python3 tools/translate-vocab.py --dry-run    # show what would change

The script batches ~25 cards per API call to keep cost low (Claude Haiku).
At ~1600 cards total, expect ≤$0.30 in API charges.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import pathlib
import re
import sys
from typing import Optional

try:
    from anthropic import Anthropic
except ImportError:
    print("ERROR: install the anthropic package:  pip install anthropic", file=sys.stderr)
    sys.exit(1)

MODEL = "claude-haiku-4-5-20251001"
BATCH_SIZE = 25

CARDS_PATTERN = re.compile(r"(const CARDS\s*=\s*\[)(.*?)(\n\];)", re.S)
CARD_PATTERN = re.compile(
    r"\{\s*cat\s*:\s*\"([^\"]*)\"\s*,\s*"
    r"hu\s*:\s*\"([^\"]*)\"\s*,\s*"
    r"en\s*:\s*\"([^\"]*)\"\s*,\s*"
    r"example\s*:\s*\"((?:[^\"\\]|\\.)*)\"\s*"
    r"(?:,\s*exampleHu\s*:\s*\"((?:[^\"\\]|\\.)*)\"\s*)?"
    r"\}"
)


def js_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("\"", "\\\"")


def js_unescape(s: str) -> str:
    return s.replace('\\"', '"').replace("\\\\", "\\")


def parse_cards(card_block: str):
    out = []
    for m in CARD_PATTERN.finditer(card_block):
        cat, hu, en, example, example_hu = m.groups()
        out.append({
            "cat": cat,
            "hu": hu,
            "en": en,
            "example": js_unescape(example),
            "exampleHu": js_unescape(example_hu) if example_hu else None,
            "_span": m.span(),
        })
    return out


def translate_batch(client: Anthropic, batch: list[dict], slug: str) -> list[str]:
    """Translate a batch of English example sentences to Hungarian."""
    numbered = "\n".join(
        f"{i+1}. en={c['en']!r} | example={c['example']!r}" for i, c in enumerate(batch)
    )
    prompt = (
        "You are translating example sentences for a Hungarian-for-English-learners "
        "flashcard app (module: {slug}). Each line gives the English word plus an "
        "example sentence. Translate ONLY the example sentence to natural, "
        "conversational Hungarian. Keep tone similar, preserve the word being "
        "illustrated. Return EXACTLY a JSON array of {n} strings, one per example, "
        "nothing else.\n\n"
        "{numbered}\n\n"
        "JSON array:"
    ).format(slug=slug, n=len(batch), numbered=numbered)

    resp = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        arr = json.loads(text)
    except json.JSONDecodeError:
        raise RuntimeError(f"could not parse JSON from model:\n{text[:500]}")
    if not isinstance(arr, list) or len(arr) != len(batch):
        raise RuntimeError(f"expected {len(batch)} translations, got {len(arr) if isinstance(arr, list) else 'non-list'}")
    return [str(s) for s in arr]


def rebuild_card_js(card: dict) -> str:
    parts = [
        f'cat:"{js_escape(card["cat"])}"',
        f'hu:"{js_escape(card["hu"])}"',
        f'en:"{js_escape(card["en"])}"',
        f'example:"{js_escape(card["example"])}"',
    ]
    if card.get("exampleHu"):
        parts.append(f'exampleHu:"{js_escape(card["exampleHu"])}"')
    return "{ " + ", ".join(parts) + " }"


def process_file(path: pathlib.Path, client: Optional[Anthropic], dry_run: bool):
    src = path.read_text(encoding="utf-8")
    m = CARDS_PATTERN.search(src)
    if not m:
        print(f"  [skip] no CARDS array found in {path.name}")
        return

    block = m.group(2)
    cards = parse_cards(block)
    if not cards:
        print(f"  [skip] couldn't parse any cards in {path.name}")
        return

    to_translate = [c for c in cards if not c["exampleHu"]]
    print(f"  {path.name}: {len(cards)} cards total, {len(to_translate)} missing exampleHu")
    if not to_translate:
        return
    if dry_run:
        for c in to_translate[:3]:
            print(f"    would translate: {c['example']}")
        if len(to_translate) > 3:
            print(f"    ... +{len(to_translate) - 3} more")
        return
    if client is None:
        print("  [skip] no client (probably --dry-run path error)")
        return

    slug = path.stem
    for i in range(0, len(to_translate), BATCH_SIZE):
        batch = to_translate[i : i + BATCH_SIZE]
        print(f"    translating batch {i // BATCH_SIZE + 1}/{(len(to_translate) + BATCH_SIZE - 1) // BATCH_SIZE} ({len(batch)} cards)...")
        translations = translate_batch(client, batch, slug)
        for c, t in zip(batch, translations):
            c["exampleHu"] = t

    # Rebuild the CARDS block keeping original indentation / trailing commas
    lines = []
    for c in cards:
        lines.append("  " + rebuild_card_js(c) + ",")
    # Drop the trailing comma from the last one for cleanliness
    if lines:
        lines[-1] = lines[-1].rstrip(",")
    new_block = "\n" + "\n".join(lines) + "\n"

    new_src = src[: m.start(2)] + new_block + src[m.end(2) :]
    path.write_text(new_src, encoding="utf-8")
    print(f"    wrote {len(to_translate)} new translations")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*", help="vocab-*.html files (default: all)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.files:
        files = [pathlib.Path(f) for f in args.files]
    else:
        files = sorted(pathlib.Path(f) for f in glob.glob("vocab-*.html"))
    if not files:
        print("no vocab-*.html files found; run from the repo root")
        sys.exit(1)

    client = None
    if not args.dry_run:
        if not os.getenv("ANTHROPIC_API_KEY"):
            print("ERROR: set ANTHROPIC_API_KEY env var", file=sys.stderr)
            sys.exit(1)
        client = Anthropic()

    print(f"processing {len(files)} file(s){' (dry run)' if args.dry_run else ''}")
    for f in files:
        print(f"- {f}")
        process_file(f, client, args.dry_run)

    print("done.")


if __name__ == "__main__":
    main()
