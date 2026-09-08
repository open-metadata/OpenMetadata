#!/usr/bin/env python3
"""Harness-integrity checks — keep the agent-facing config from silently decaying.

Seven checks, all emitting GitHub Actions **warning** annotations (never failing) unless
run with ``--strict``:

  1. dead-reference       — a path / make target / yarn script / maven goal named in the
                            agent docs or a SKILL.md that no longer resolves
  2. agents-sync          — AGENTS.md drifting from CLAUDE.md's corrected stack facts
  3. skill-symlinks       — a real file where a symlink into skills/ is expected, or two
                            SKILL.md sharing a name with different content
  4. doc-size             — CLAUDE.md > 200 lines, ARCHITECTURE.md > 300, a rule file > 100
  5. rule-globs           — a .claude/rules/ paths: glob that matches zero files
  6. generated-fresh      — docs/generated/** out of date with its source
  7. baseline-freshness   — timing-baseline.json still lists an entire Playwright spec
                            as skipped though the spec has live `test(...)` calls (i.e.
                            the suite was re-enabled without a baseline refresh — the
                            shard planner will under-budget it; see #30812)

Run locally with ``make harness-check`` or ``python3 scripts/harness/check_harness.py``.
Stdlib only; deterministic; safe to run anywhere in the tree.
"""

import json
import os
import re
import subprocess
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", ".."))

# Files whose code-span references are dead-ref checked (check 1).
REF_DOCS = ["CLAUDE.md", "AGENTS.md", "ARCHITECTURE.md", "docs/index.md", "docs/design-patterns.md"]
RULES_DIR = ".claude/rules"

# Path prefixes that legitimately do not exist in a fresh checkout (gitignored /
# build output). References under these are skipped by the dead-ref path check.
EPHEMERAL_PREFIXES = (
    "ingestion/src/metadata/generated",
    "ingestion-core/src/metadata/generated",
    "openmetadata-ui/src/main/resources/ui/node_modules",
    "node_modules",
    "env/",
    "dist/",
)
EPHEMERAL_SUBSTR = ("/target/", "/node_modules/", "/generated/antlr")

# Directories pruned when walking to test a glob (check 1 globs + check 5).
PRUNE_DIRS = {"node_modules", ".git", "target", "dist", "env", ".mvn", ".yarn"}

YARN_BUILTINS = {
    "install", "add", "remove", "upgrade", "upgrade-interactive", "why", "run",
    "global", "dlx", "create", "init", "link", "unlink", "pack", "publish",
    "cache", "config", "node", "exec", "workspaces", "workspace", "info", "list",
    "outdated", "audit", "import", "licenses", "login", "logout", "version",
    "versions", "bin", "check", "autoclean", "policies", "set",
}

MAVEN_PHASES = {
    "pre-clean", "clean", "post-clean", "validate", "initialize", "generate-sources",
    "process-sources", "generate-resources", "process-resources", "compile",
    "process-classes", "generate-test-sources", "test-compile", "test",
    "prepare-package", "package", "pre-integration-test", "integration-test",
    "post-integration-test", "verify", "install", "deploy", "site", "site-deploy",
}
MAVEN_GOAL_ALLOWLIST = {
    "spotless:apply", "spotless:check", "license:check", "license:format",
    "dependency:tree", "help:effective-pom", "versions:display-dependency-updates",
    "clean:clean",
}

class Warn:
    __slots__ = ("check", "file", "line", "message")

    def __init__(self, check, file, line, message):
        self.check = check
        self.file = file
        self.line = line
        self.message = message


def rp(*parts):
    return os.path.join(REPO, *parts)


def read(path):
    with open(rp(path), encoding="utf-8") as handle:
        return handle.read()


def read_lines(path):
    return read(path).splitlines()


# --------------------------------------------------------------------------- globs


def expand_braces(pattern):
    match = re.search(r"\{([^{}]*)\}", pattern)
    if match is None:
        return [pattern]
    out = []
    for option in match.group(1).split(","):
        out.extend(expand_braces(pattern[: match.start()] + option + pattern[match.end():]))
    return out


def glob_to_regex(pattern):
    out = []
    i = 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif pattern.startswith("**", i):
            out.append(".*")
            i += 2
        elif pattern[i] == "*":
            out.append("[^/]*")
            i += 1
        elif pattern[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(pattern[i]))
            i += 1
    return re.compile("^" + "".join(out) + "$")


def glob_has_match(pattern):
    """True if any file in the tree matches the glob (brace-aware, node_modules-pruned)."""
    regexes = [glob_to_regex(p) for p in expand_braces(pattern)]
    for dirpath, dirs, files in os.walk(REPO):
        dirs[:] = [d for d in dirs if d not in PRUNE_DIRS]
        rel_dir = os.path.relpath(dirpath, REPO)
        for name in files:
            rel = name if rel_dir == "." else f"{rel_dir}/{name}"
            rel = rel.replace(os.sep, "/")
            if any(rx.match(rel) for rx in regexes):
                return True
    return False


# ---------------------------------------------------------------- code-span parsing


INLINE_CODE_RE = re.compile(r"`([^`\n]+)`")


def iter_code_spans(text):
    """Yield (lineno, span) for fenced-block lines and inline `code` spans."""
    in_fence = False
    for lineno, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence
            continue
        if in_fence:
            yield lineno, line
        else:
            for match in INLINE_CODE_RE.finditer(line):
                start, end = match.start(), match.end()
                # Skip a markdown link label — `[`text`](target)` — the target,
                # not the backticked label, is the real reference.
                if start > 0 and line[start - 1] == "[" and end < len(line) and line[end] == "]":
                    continue
                yield lineno, match.group(1)


def clean_word(word):
    return word.strip("`'\"(),;:").rstrip(".")


# ------------------------------------------------------------------- target sources


def makefile_targets():
    targets = set()
    for mf in ("Makefile", "ingestion/Makefile"):
        if not os.path.exists(rp(mf)):
            continue
        for line in read_lines(mf):
            rule = re.match(r"^([A-Za-z0-9_][A-Za-z0-9_.\-]*)\s*:(?!=)", line)
            if rule and rule.group(1) not in (".PHONY", ".DEFAULT_GOAL"):
                targets.add(rule.group(1))
            phony = re.match(r"^\.PHONY\s*:\s*(.+)", line)
            if phony:
                targets.update(phony.group(1).split())
    return targets


def yarn_scripts():
    scripts = set()
    for pkg in (
        "openmetadata-ui/src/main/resources/ui/package.json",
        "openmetadata-ui-core-components/src/main/resources/ui/package.json",
    ):
        if os.path.exists(rp(pkg)):
            scripts.update(json.loads(read(pkg)).get("scripts", {}).keys())
    return scripts


def maven_plugin_prefixes():
    prefixes = set()
    for dirpath, dirs, files in os.walk(REPO):
        dirs[:] = [d for d in dirs if d not in PRUNE_DIRS]
        if "pom.xml" in files:
            for match in re.finditer(r"<artifactId>([a-z0-9.\-]+)</artifactId>",
                                     open(os.path.join(dirpath, "pom.xml"), encoding="utf-8").read()):
                artifact = match.group(1)
                if artifact.endswith("-plugin"):
                    prefixes.add(artifact[: -len("-plugin")].split(".")[-1])
                    prefixes.add(artifact.replace("-maven-plugin", "").replace("-plugin", ""))
    prefixes.update({"spotless", "license", "dependency", "help", "versions", "clean", "surefire", "failsafe"})
    return prefixes


# ------------------------------------------------------------------------- check 1


def repo_roots():
    return set(os.listdir(REPO))


def has_placeholder_brace(word):
    for match in re.finditer(r"\{([^{}]*)\}", word):
        if "," not in match.group(1):
            return True  # {name}, {version} — a template var, not a real brace-set
    return False


def checkable_path(word, roots):
    """A path worth resolving: anchored at a real repo root, not a placeholder/route/fragment."""
    if "/" not in word or word.startswith(("@", "http", "/", ".", "~")):
        return False
    if any(ch in word for ch in "()=<>|$!\\ ") or "..." in word or "…" in word or "://" in word:
        return False
    if has_placeholder_brace(word):
        return False
    first = word.split("/", 1)[0]
    return first in roots


def split_top_commas(value):
    """Split on commas at brace depth 0, so `a,b/{x,y}` -> ['a', 'b/{x,y}']."""
    parts, depth, cur = [], 0, ""
    for ch in value:
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def path_exists_or_glob(word):
    core = re.sub(r":\d+(-\d+)?$", "", word).rstrip("/")
    if not core:
        return True
    if core.startswith(EPHEMERAL_PREFIXES) or any(s in core for s in EPHEMERAL_SUBSTR):
        return True
    if any(ch in core for ch in "*?["):
        # A glob is satisfied if it matches ANY file (glob_has_match ORs the brace
        # alternatives) — e.g. `*.{ts,tsx,jsx}` is fine even with no .jsx files.
        return glob_has_match(core)
    # A concrete brace-set like `{flyway,native}` asserts every alternative exists.
    return all(os.path.exists(rp(expanded)) for expanded in expand_braces(core))


def first_arg(words, start):
    """First non-flag, non-assignment token after a command (skipping -flags and X=Y)."""
    for token in words[start:]:
        cand = clean_word(token)
        if cand.startswith("-") or "=" in cand or not cand:
            continue
        return cand
    return None


def check_dead_references():
    warnings = []
    roots = repo_roots()
    targets = makefile_targets()
    scripts = yarn_scripts()
    mvn_prefixes = maven_plugin_prefixes()

    files = [f for f in REF_DOCS if os.path.exists(rp(f))]
    if os.path.isdir(rp(RULES_DIR)):
        files += [f"{RULES_DIR}/{n}" for n in sorted(os.listdir(rp(RULES_DIR))) if n.endswith(".md")]
    for dirpath, dirs, filenames in os.walk(rp("skills")):
        # skills/vendor/** is third-party, copied verbatim from upstream. Its
        # paths and commands refer to the projects it came from, so checking
        # them against this repo produces only noise, and we must not "fix" a
        # vendored file anyway — edits are lost on the next refresh.
        dirs[:] = [d for d in dirs if d not in PRUNE_DIRS and d != "vendor"]
        for name in filenames:
            if name == "SKILL.md":
                files.append(os.path.relpath(os.path.join(dirpath, name), REPO))

    for rel in files:
        text = read(rel)
        for lineno, span in iter_code_spans(text):
            words = span.split()
            for raw in words:
                word = clean_word(raw)
                if checkable_path(word, roots) and not path_exists_or_glob(word):
                    warnings.append(Warn("dead-reference", rel, lineno,
                                         f"path does not resolve: `{word}`"))
            # Commands are only trusted at the start of a code span / fenced line
            # (optionally behind a `$ ` shell prompt) — never mid-prose.
            head = re.match(r"^\$?\s*(make|yarn|mvn)\b", span.strip())
            if head is None:
                continue
            cmd = head.group(1)
            cmd_index = next(i for i, w in enumerate(words) if clean_word(w) == cmd)
            arg = first_arg(words, cmd_index + 1)
            if arg is None:
                continue
            if cmd == "make" and re.match(r"^[a-z0-9][a-z0-9_.\-]*$", arg) and arg not in targets:
                warnings.append(Warn("dead-reference", rel, lineno,
                                     f"make target not defined: `make {arg}`"))
            elif cmd == "yarn" and arg not in scripts and arg not in YARN_BUILTINS:
                warnings.append(Warn("dead-reference", rel, lineno,
                                     f"yarn script/command unknown: `yarn {arg}`"))
            elif cmd == "mvn" and re.match(r"^[a-z][a-z0-9-]*:[a-z0-9-]+$", arg):
                if arg not in MAVEN_GOAL_ALLOWLIST and arg.split(":")[0] not in mvn_prefixes:
                    warnings.append(Warn("dead-reference", rel, lineno,
                                         f"maven goal's plugin not found in any pom: `{arg}`"))
    return warnings


# ------------------------------------------------------------------------- check 2


def check_agents_sync():
    """AGENTS.md must be a symlink to CLAUDE.md, so the two can never drift."""
    warnings = []
    agents = rp("AGENTS.md")
    if not os.path.lexists(agents):
        return warnings
    if not os.path.islink(agents) or os.path.realpath(agents) != os.path.realpath(rp("CLAUDE.md")):
        warnings.append(Warn("agents-sync", "AGENTS.md", 1,
                             "AGENTS.md should be a symlink to CLAUDE.md - run: ln -sf CLAUDE.md AGENTS.md"))
    return warnings


# ------------------------------------------------------------------------- check 3


def check_skill_symlinks():
    warnings = []
    canonical = {}  # skill name -> content hash of skills/<name>/SKILL.md
    if os.path.isdir(rp("skills")):
        for name in os.listdir(rp("skills")):
            skill_md = rp("skills", name, "SKILL.md")
            if os.path.isfile(skill_md):
                canonical[name] = read(os.path.relpath(skill_md, REPO))

    for mirror in (".claude/skills", ".agents/skills"):
        base = rp(mirror)
        if not os.path.isdir(base):
            continue
        for name in os.listdir(base):
            entry = os.path.join(base, name)
            rel = f"{mirror}/{name}"
            if name not in canonical:
                continue  # mirror-only skill (legitimately real); not "expected symlink"
            if not os.path.islink(entry):
                warnings.append(Warn("skill-symlinks", rel, 1,
                                     f"expected a symlink into skills/{name}, found a real file/dir"))
                continue
            inner = os.path.join(entry, "SKILL.md")
            if os.path.isfile(inner):
                content = open(inner, encoding="utf-8").read()
                if content != canonical[name]:
                    warnings.append(Warn("skill-symlinks", rel, 1,
                                         f"SKILL.md content diverges from skills/{name}/SKILL.md"))
    return warnings


# ------------------------------------------------------------------------- check 4


def check_doc_size():
    warnings = []
    budgets = {"CLAUDE.md": 200, "ARCHITECTURE.md": 300}
    for path, limit in budgets.items():
        if os.path.exists(rp(path)):
            n = len(read_lines(path))
            if n > limit:
                warnings.append(Warn("doc-size", path, 1, f"{n} lines exceeds budget of {limit}"))
    if os.path.isdir(rp(RULES_DIR)):
        for name in sorted(os.listdir(rp(RULES_DIR))):
            if name.endswith(".md"):
                rel = f"{RULES_DIR}/{name}"
                n = len(read_lines(rel))
                if n > 100:
                    warnings.append(Warn("doc-size", rel, 1, f"{n} lines exceeds rule budget of 100"))
    return warnings


# ------------------------------------------------------------------------- check 5


def parse_rule_paths(text):
    if not text.startswith("---"):
        return []
    end = text.find("\n---", 3)
    if end == -1:
        return []
    front = text[3:end]
    match = re.search(r"^paths:\s*(.+)$", front, re.M)
    if match is None:
        return []
    value = match.group(1).strip()
    if value.startswith("["):
        value = value.strip("[]")
    # Multiple globs may be comma-separated in one scalar; but a comma inside
    # `{ts,tsx}` must not split. split_top_commas handles both.
    return [g.strip("'\"") for g in split_top_commas(value) if g.strip("'\"")]


def check_rule_globs():
    warnings = []
    if not os.path.isdir(rp(RULES_DIR)):
        return warnings
    for name in sorted(os.listdir(rp(RULES_DIR))):
        if not name.endswith(".md"):
            continue
        rel = f"{RULES_DIR}/{name}"
        for glob_pattern in parse_rule_paths(read(rel)):
            if glob_pattern.startswith(EPHEMERAL_PREFIXES):
                continue  # e.g. ingestion/.../generated/** is gitignored (empty in a fresh checkout)
            if not glob_has_match(glob_pattern):
                warnings.append(Warn("rule-globs", rel, 1,
                                     f"paths: glob matches zero files: `{glob_pattern}`"))
    return warnings


# ---------------------------------------------------------------- check 7 (baseline)


PLAYWRIGHT_BASELINE = ".github/playwright/timing-baseline.json"
PLAYWRIGHT_E2E_ROOT = "openmetadata-ui/src/main/resources/ui/playwright/e2e"
# Match `test(...` calls in a spec file — but NOT `test.describe(`, `test.step(`,
# `test.beforeAll(`, `test.only(`, `test.skip(`, etc. `test.only(` and `test.fixme(`
# should not appear in merged code either, but a `test.skip(` is a valid signal
# that the case is still intentionally disabled, so it is treated as *not live*.
_LIVE_TEST_CALL = re.compile(r"(?<![A-Za-z_.])test\s*\(")


def _spec_has_live_tests(path):
    try:
        text = read(path)
    except (FileNotFoundError, IsADirectoryError):
        return None
    return len(_LIVE_TEST_CALL.findall(text))


def check_baseline_freshness():
    warnings = []
    baseline_path = rp(PLAYWRIGHT_BASELINE)
    if not os.path.exists(baseline_path):
        return warnings
    try:
        payload = json.loads(read(PLAYWRIGHT_BASELINE))
    except json.JSONDecodeError:
        return warnings
    by_file = {}
    for entry in payload.get("tests", []):
        by_file.setdefault(entry.get("file", ""), []).append(entry)
    for file, entries in sorted(by_file.items()):
        if not file:
            continue
        if not all(
            e.get("outcome") == "skipped" and e.get("durationMs", 0) == 0
            for e in entries
        ):
            continue
        spec_rel = f"{PLAYWRIGHT_E2E_ROOT}/{file}"
        live = _spec_has_live_tests(spec_rel)
        if not live:
            continue  # spec is truly skipped end-to-end, or missing (renamed)
        warnings.append(
            Warn(
                "baseline-freshness",
                PLAYWRIGHT_BASELINE,
                1,
                (
                    f"{file}: baseline records {len(entries)} skipped entries with 0 ms "
                    f"but the spec has {live} live `test(...)` call(s). Refresh the baseline "
                    "(seed observed durations, or wait for the next full-run capture) — "
                    "otherwise the planner will pack the re-enabled suite onto one shard "
                    "and the shard will time out on the merge queue (see #30812)."
                ),
            )
        )
    return warnings


# ------------------------------------------------------------------------- check 6


def check_generated_fresh():
    warnings = []
    generators = ("scripts/generate_entity_index.py", "scripts/generate_api_reference.py")
    if not all(os.path.exists(rp(g)) for g in generators):
        return warnings
    for gen in generators:
        subprocess.run([sys.executable, rp(gen)], cwd=REPO,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    diff = subprocess.run(["git", "diff", "--name-only", "--", "docs/generated"],
                          cwd=REPO, capture_output=True, text=True, check=False)
    for path in diff.stdout.split():
        warnings.append(Warn("generated-fresh", path, 1,
                             "out of date with its source — run `make generate-reference-docs` and commit"))
    return warnings


# ------------------------------------------------------------------------------ main


CHECKS = [
    check_dead_references,
    check_agents_sync,
    check_skill_symlinks,
    check_doc_size,
    check_rule_globs,
    check_generated_fresh,
    check_baseline_freshness,
]


def main():
    strict = "--strict" in sys.argv
    all_warnings = []
    for check in CHECKS:
        try:
            all_warnings.extend(check())
        except Exception as exc:  # a broken check must not crash the whole run
            print(f"::warning::harness check {check.__name__} errored: {exc}")

    for warn in all_warnings:
        print(f"::warning file={warn.file},line={warn.line}::[{warn.check}] {warn.message}")

    print("\n=== harness-integrity summary ===")
    if not all_warnings:
        print("no warnings — all six checks clean")
    else:
        by_check = {}
        for warn in all_warnings:
            by_check.setdefault(warn.check, []).append(warn)
        for check in sorted(by_check):
            print(f"\n{check} ({len(by_check[check])}):")
            for warn in by_check[check]:
                print(f"  {warn.file}:{warn.line}  {warn.message}")
        print(f"\ntotal: {len(all_warnings)} warning(s)")

    sys.exit(1 if (strict and all_warnings) else 0)


if __name__ == "__main__":
    main()
