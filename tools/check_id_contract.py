#!/usr/bin/env python3
"""Static id-contract check for CasinoPlanet.

Shared client code in src/**/*.js addresses the DOM by id. index.html and mobile.html
are independent forks that both load that code, so an id one page renamed or dropped is
a silent contract break. This derives the required ids from source and reports every
page that lacks one.

  python3 tools/check_id_contract.py                 check; exit 1 on any failure
  python3 tools/check_id_contract.py --write-waiver  regenerate tools/id_contract_waiver.json

Two tiers:
  Tier 1  unguarded dereference -- hard failure, no waivers permitted.
  Tier 2  static absence        -- gated on tools/id_contract_waiver.json.
"""
import argparse
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ('index.html', 'mobile.html')
WAIVER_PATH = os.path.join(REPO, 'tools', 'id_contract_waiver.json')

# ---------------------------------------------------------------- extraction

RE_GEBI = re.compile(r"""getElementById\(\s*(['"])([^'"]+)\1\s*\)""")
RE_QS = re.compile(r"""querySelector(?:All)?\(\s*(['"])([^'"]*)\1\s*\)""")
RE_IDSEL = re.compile(r"#([A-Za-z0-9_\-]+)")
RE_ID_ASSIGN = re.compile(r"""\.id\s*=\s*(['"])([^'"]+)\1""")
RE_ID_ATTR = re.compile(r"""\bid\s*=\s*(['"])([^'"]+)\1""")
RE_TEMPLATE = re.compile(r"`(?:[^`\\]|\\.)*`", re.S)
RE_QUOTED = re.compile(r"""'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*\"""")

RE_BINDING = re.compile(
    r"""(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"""
    r"""document\.getElementById\(\s*(['"])([^'"]+)\2\s*\)""")
RE_DIRECT = re.compile(
    r"""document\.getElementById\(\s*(['"])([^'"]+)\1\s*\)\s*(?=[.\[])""")


def js_sources():
    """Every src/**/*.js, sorted so results are deterministic."""
    out = []
    for base, _dirs, files in os.walk(os.path.join(REPO, 'src')):
        for f in files:
            if f.endswith('.js'):
                out.append(os.path.join(base, f))
    return sorted(out)


def line_of(text, pos):
    return text.count('\n', 0, pos) + 1


def rel(path):
    return os.path.relpath(path, REPO).replace(os.sep, '/')


def extract(text):
    """-> (looked_up {id: [line]}, runtime_created {id: [line]})"""
    looked, created = {}, {}
    for m in RE_GEBI.finditer(text):
        looked.setdefault(m.group(2), []).append(line_of(text, m.start()))
    for m in RE_QS.finditer(text):
        for i in RE_IDSEL.findall(m.group(2)):
            looked.setdefault(i, []).append(line_of(text, m.start()))
    # runtime-created: el.id = 'X'
    for m in RE_ID_ASSIGN.finditer(text):
        created.setdefault(m.group(2), []).append(line_of(text, m.start()))
    # runtime-created: id="X" inside a template literal, or inside a quoted
    # string that contains '<' (i.e. an HTML fragment being injected)
    for m in RE_TEMPLATE.finditer(text):
        for a in RE_ID_ATTR.finditer(m.group(0)):
            created.setdefault(a.group(2), []).append(line_of(text, m.start()))
    for m in RE_QUOTED.finditer(text):
        if '<' in m.group(0):
            for a in RE_ID_ATTR.finditer(m.group(0)):
                created.setdefault(a.group(2), []).append(line_of(text, m.start()))
    return looked, created


# ---------------------------------------------------------------- tier 1

def _block_end(text, pos):
    """End of the block enclosing `pos` -- the '}' that closes it."""
    depth = 0
    for i in range(pos, len(text)):
        c = text[i]
        if c == '{':
            depth += 1
        elif c == '}':
            if depth == 0:
                return i
            depth -= 1
    return len(text)


def classify_guards(text):
    """-> (unguarded {id: [(kind, line)]}, guarded {id: [(kind, line)]})

    Unguarded means the lookup's result is dereferenced with no null check:
      * document.getElementById('X').member   -- direct member access, or
      * const V = document.getElementById('X') whose first V. / V[ use inside the
        enclosing block is not preceded by an  if (V, if (!V, V &&, && V  or  V?  guard.
    """
    unguarded, guarded = {}, {}
    for m in RE_DIRECT.finditer(text):
        unguarded.setdefault(m.group(2), []).append(('direct', line_of(text, m.start())))
    for m in RE_BINDING.finditer(text):
        var, name = m.group(1), m.group(3)
        region = text[m.end():_block_end(text, m.end())]
        use = re.search(r"\b%s\s*(?:\.|\[)" % re.escape(var), region)
        if not use:
            continue                      # bound but never dereferenced
        span = region[:use.start()]
        span += region[region.rfind('\n', 0, use.start()) + 1:use.start()]
        v = re.escape(var)
        is_guarded = bool(
            re.search(r"if\s*\(\s*!?\s*%s\b" % v, span)
            or re.search(r"\b%s\s*&&" % v, span)
            or re.search(r"&&\s*!?\s*%s\b" % v, span)
            or re.search(r"\b%s\s*\?" % v, span))
        bucket = guarded if is_guarded else unguarded
        bucket.setdefault(name, []).append(('binding:' + var, line_of(text, m.start())))
    return unguarded, guarded


# ------------------------------------------------- classifier ground truth

# Frozen fixtures, not live source. The remedies this check exists to drive
# (guarding a deref, adding markup) change the live source; pinning the
# assertions to fixtures keeps them testing the CLASSIFIER rather than the
# tree's current state. Each fixture is the pristine 2984e69 shape.
GROUND_TRUTH = [
    # (name, source snippet, expected: 'unguarded' | 'guarded')
    ('chip-balance', """
      document.getElementById('chip-balance').innerText = this.chips.toLocaleString();
    """, 'unguarded'),
    ('need-bar-thirst', """
      const thirstBar = document.getElementById('need-bar-thirst');
      const thirst = char.needs ? Math.floor(char.needs.thirst) : 100;
      thirstBar.style.width = thirst + '%';
    """, 'unguarded'),
    ('rating-value', """
      const ratingEl = document.getElementById('rating-value');
      if (ratingEl) {
        ratingEl.innerText = (this.state.starRating || 4.2).toFixed(1);
      }
    """, 'guarded'),
    ('guest-ratio', """
      const guestRatioEl = document.getElementById('guest-ratio');
      const happinessBarEl = document.getElementById('happiness-bar');
      if (guestRatioEl && happinessBarEl) {
        guestRatioEl.innerText = ratioDisplay;
        happinessBarEl.style.width = fillPct;
      }
    """, 'guarded'),
    ('happiness-bar', """
      const guestRatioEl = document.getElementById('guest-ratio');
      const happinessBarEl = document.getElementById('happiness-bar');
      if (guestRatioEl && happinessBarEl) {
        guestRatioEl.innerText = ratioDisplay;
        happinessBarEl.style.width = fillPct;
      }
    """, 'guarded'),
]


def run_ground_truth():
    failures = []
    for name, snippet, expected in GROUND_TRUTH:
        ung, gua = classify_guards(snippet)
        got = 'unguarded' if name in ung else ('guarded' if name in gua else 'unclassified')
        if got != expected:
            failures.append(f'{name}: expected {expected}, classifier said {got}')
    return failures


# ---------------------------------------------------------------- pages

def page_ids(page):
    with open(os.path.join(REPO, page), encoding='utf-8') as f:
        return {m.group(2) for m in RE_ID_ATTR.finditer(f.read())}


def analyse():
    looked, created, unguarded, guarded = {}, {}, {}, {}
    for path in js_sources():
        with open(path, encoding='utf-8') as f:
            text = f.read()
        r = rel(path)
        lo, cr = extract(text)
        for d, src in ((looked, lo), (created, cr)):
            for k, lines in src.items():
                d.setdefault(k, []).extend(f'{r}:{n}' for n in lines)
        ug, gu = classify_guards(text)
        for d, src in ((unguarded, ug), (guarded, gu)):
            for k, hits in src.items():
                d.setdefault(k, []).extend(f'{r}:{n} ({kind})' for kind, n in hits)
    static_required = set(looked) - set(created)
    return {
        'looked': looked, 'created': created, 'unguarded': unguarded,
        'guarded': guarded, 'static_required': static_required,
    }


def reason_for(a, page, name):
    site = (a['unguarded'].get(name) or a['guarded'].get(name)
            or a['looked'].get(name) or ['<unknown>'])[0]
    kind = 'unguarded' if name in a['unguarded'] else 'guarded'
    return f'{kind} lookup at {site}; feature has no counterpart in {page}'


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--write-waiver', action='store_true',
                    help='regenerate tools/id_contract_waiver.json from the current tree')
    args = ap.parse_args()

    a = analyse()
    static_required = a['static_required']
    failures = []

    print(f'js sources           : {len(js_sources())}')
    print(f'looked up            : {len(a["looked"])}')
    print(f'runtime-created      : {len(a["created"])}')
    print(f'static-required      : {len(static_required)}')

    # --- self-test: the runtime-created subtraction must not mask a real contract
    both = set(a['looked']) & set(a['created'])
    leaked = sorted(both & page_ids('index.html'))
    print(f'self-test            : {len(both)} ids both looked-up and runtime-created; '
          f'{len(leaked)} of them appear statically in index.html (must be 0)')
    if leaked:
        failures.append(f'SELF-TEST: runtime-created classification masks real static '
                        f'contract for {leaked} -- the subtraction is under-reporting')

    # --- classifier ground truth
    gt = run_ground_truth()
    print(f'classifier fixtures  : {len(GROUND_TRUTH) - len(gt)}/{len(GROUND_TRUTH)} pass')
    for f in gt:
        failures.append(f'GROUND-TRUTH: {f}')

    # --- tier 1
    tier1 = {}
    for page in PAGES:
        ids = page_ids(page)
        tier1[page] = sorted((set(a['unguarded']) & static_required) - ids)

    # --- tier 2
    tier2 = {}
    for page in PAGES:
        ids = page_ids(page)
        tier2[page] = sorted(static_required - ids)

    if args.write_waiver:
        waiver = {p: {n: reason_for(a, p, n) for n in tier2[p] if n not in tier1[p]}
                  for p in PAGES}
        with open(WAIVER_PATH, 'w', encoding='utf-8') as f:
            json.dump(waiver, f, indent=2, sort_keys=True)
            f.write('\n')
        print(f'\nwrote {rel(WAIVER_PATH)}: ' +
              ', '.join(f'{p} {len(waiver[p])}' for p in PAGES))
        if any(tier1[p] for p in PAGES):
            print('WARNING: tier-1 violations exist and were NOT waived (never waivable).')
        return 0

    waiver = {}
    if os.path.exists(WAIVER_PATH):
        with open(WAIVER_PATH, encoding='utf-8') as f:
            waiver = json.load(f)
    else:
        print(f'\nnote: {rel(WAIVER_PATH)} absent -- nothing is suppressed')

    print()
    for page in PAGES:
        print(f'=== {page} ({len(page_ids(page))} ids defined) ===')
        print(f'  TIER 1 unguarded-deref gaps : {len(tier1[page])}')
        for n in tier1[page]:
            print(f'    - {n}   {a["unguarded"][n][0]}')
            failures.append(f'TIER 1 [{page}] {n} is dereferenced without a null guard '
                            f'({a["unguarded"][n][0]}) and is absent from the page')
        pw = waiver.get(page, {})
        unwaived = [n for n in tier2[page] if n not in pw]
        print(f'  TIER 2 static-absence gaps  : {len(tier2[page])} '
              f'({len(pw)} waived, {len(unwaived)} unwaived)')
        for n in unwaived:
            print(f'    - {n}   {(a["looked"].get(n) or ["?"])[0]}')
            failures.append(f'TIER 2 [{page}] {n} is required by shared code, absent from '
                            f'the page, and not in the waiver')
        for n, why in sorted(pw.items()):
            if n in tier1[page]:
                failures.append(f'WAIVER [{page}] {n} is a tier-1 id; tier 1 admits no waivers')
            if not str(why).strip():
                failures.append(f'WAIVER [{page}] {n} carries no reason')
            if n not in tier2[page]:
                failures.append(f'WAIVER [{page}] {n} is waived but is not a gap; '
                                f'delete the stale entry')

    print()
    if failures:
        print(f'FAILED ({len(failures)} problem(s)):')
        for f in failures:
            print(f'  * {f}')
        return 1
    print('OK: id contract satisfied for ' + ', '.join(PAGES))
    return 0


if __name__ == '__main__':
    sys.exit(main())
