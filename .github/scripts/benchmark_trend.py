#!/usr/bin/env python3
"""Track nightly benchmark p95s over time, publish the trend, and flag regressions.

The nightly Java IT jobs leave BenchmarkReport envelopes in target/benchmark:
lineage-scene-scale-<tables>.json from LineageScenePerformanceScaleIT, and api-latency-<suite>.json
from every suite (ApiLatencyReportListener records each SDK and browser API call). This script
turns one night's reports plus the nights before it into:

  * a job-summary table per series: latest p95, the median of the previous nights, the change,
    a sparkline and a verdict;
  * TRENDS.md with SVG trend charts, regenerated over the whole history — a checkout of the
    openmetadata-nightly `benchmark-history` branch;
  * a Slack payload carrying the same verdicts;
  * exit code 1 when a gated benchmark regressed and --fail-on-regression is set.

    ./benchmark_trend.py --reports ./artifacts --history ./history --ref main \\
        --run-id 123 --run-url https://... --record --write-trends \\
        --summary-out "$GITHUB_STEP_SUMMARY" --slack-out slack.json \\
        --gate lineage-scene-scale --fail-on-regression

The caveat of compare_benchmark_metrics.py applies: two nights are not a controlled experiment.
The baseline is the median of several nights, so one noisy night neither raises nor hides an
alarm, and nothing is judged until a scenario has --min-history nights behind it.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import statistics
import sys
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

import benchmark_trend_svg as svg
from compare_benchmark_metrics import (
    COMPARED_METRIC,
    IMPROVED_LABEL,
    REGRESSED_LABEL,
    UNCHANGED_LABEL,
    ComparisonError,
    _require_supported_schema,
)

WARMING_UP_LABEL = "warming up"
FEW_SAMPLES_LABEL = "few samples"
NOT_MEASURED_LABEL = "not measured"
VERDICT_CELLS = {
    REGRESSED_LABEL: "**▲ slower**",
    IMPROVED_LABEL: "▼ faster",
    UNCHANGED_LABEL: "=",
}
SPARK_CHARS = "▁▂▃▄▅▆▇█"
SPARK_GAP = "·"
RUN_FILE = "run.json"
RUNS_DIR = "runs"
CHARTS_DIR = "charts"
TRENDS_FILE = "TRENDS.md"
API_LATENCY_ID = "api-latency"
LINEAGE_SCENE_ID = "lineage-scene-scale"
SMALL_MULTIPLE_WIDTH = 372
SMALL_MULTIPLE_PLOT_HEIGHT = 120
UNKNOWN = "unknown"


@dataclass(frozen=True)
class Settings:
    baseline_runs: int = 7
    min_history: int = 5
    tolerance_pct: float = 25.0
    noise_floor_ms: int = 25
    min_samples: int = 5
    window: int = 30
    api_rows: int = 25
    api_charts: int = 8


@dataclass(frozen=True)
class RunInfo:
    run_id: str
    started_at: str
    ref: str
    url: str | None = None
    git_sha: str | None = None

    @property
    def key(self) -> str:
        """Sortable directory name: chronological first, run id to keep same-second runs apart."""
        stamp = datetime.fromisoformat(self.started_at.replace("Z", "+00:00"))
        return f"{stamp.astimezone(timezone.utc):%Y%m%dT%H%M%SZ}-{self.run_id}"

    @property
    def label(self) -> str:
        stamp = datetime.fromisoformat(self.started_at.replace("Z", "+00:00"))
        return f"{stamp:%m-%d}"


@dataclass
class RecordedRun:
    info: RunInfo
    reports: dict[str, dict[str, Any]] = field(default_factory=dict)


@dataclass(frozen=True)
class Row:
    scenario: str
    p95: int | None
    baseline: float | None
    change_pct: float | None
    verdict: str
    samples: int
    sparkline: str


@dataclass(frozen=True)
class SeriesResult:
    series: str
    benchmark_id: str
    description: str
    rows: list[Row]

    @property
    def regressions(self) -> list[Row]:
        return [row for row in self.rows if row.verdict == REGRESSED_LABEL]


# ---------------------------------------------------------------- reports


def load_reports(paths: list[Path]) -> list[dict[str, Any]]:
    """Every enveloped report under `paths`; the older bare metrics files are skipped."""
    reports = []
    for path in paths:
        files = sorted(path.rglob("*.json")) if path.is_dir() else [path]
        for file in files:
            report = _read_json(file)
            if isinstance(report, dict) and "benchmarkId" in report and "latencies" in report:
                _require_supported_schema(report, file)
                reports.append(report)
    return reports


def series_key(report: dict[str, Any]) -> str:
    """One line on the trend page: a benchmark at a fixed size, or one suite's API traffic."""
    params = report.get("params", {})
    benchmark_id = report["benchmarkId"]
    if "suite" in params:
        return f"{benchmark_id}/{params['suite']}"
    if "tables" in params:
        return f"{benchmark_id}/{params['tables']}-tables"
    return benchmark_id


def describe(report: dict[str, Any]) -> str:
    params = report.get("params", {})
    if "suite" in params:
        return f"suite `{params['suite']}`"
    if "tables" in params:
        return f"{params['tables']:,} tables · {params.get('edges', '?'):,} edges"
    return report["benchmarkId"]


def slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", text).strip("-")


def _read_json(file: Path) -> Any:
    try:
        return json.loads(file.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"warning: skipping unreadable {file}: {error}", file=sys.stderr)
        return None


# ---------------------------------------------------------------- history


class History:
    """runs/<ref>/<run key>/ — one directory per nightly run, one file per series."""

    def __init__(self, root: Path) -> None:
        self.root = root

    def record(self, info: RunInfo, reports: list[dict[str, Any]], keep_runs: int) -> None:
        ref_dir = self._ref_dir(info.ref)
        for stale in ref_dir.glob(f"*-{slug(info.run_id)}"):
            shutil.rmtree(stale)
        run_dir = ref_dir / info.key
        run_dir.mkdir(parents=True)
        (run_dir / RUN_FILE).write_text(json.dumps(asdict(info), indent=2) + "\n")
        for report in reports:
            target = run_dir / f"{slug(series_key(report))}.json"
            target.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
        self._prune(ref_dir, keep_runs)

    def refs(self) -> list[str]:
        runs = self.root / RUNS_DIR
        if not runs.is_dir():
            return []
        return sorted(path.name for path in runs.iterdir() if path.is_dir())

    def load(self, ref: str) -> list[RecordedRun]:
        ref_dir = self._ref_dir(ref)
        if not ref_dir.is_dir():
            return []
        return [self._load_run(run_dir) for run_dir in sorted(ref_dir.iterdir()) if run_dir.is_dir()]

    def _load_run(self, run_dir: Path) -> RecordedRun:
        info = RunInfo(**_read_json(run_dir / RUN_FILE))
        run = RecordedRun(info)
        for file in sorted(run_dir.glob("*.json")):
            if file.name != RUN_FILE:
                report = _read_json(file)
                if report is not None:
                    run.reports[series_key(report)] = report
        return run

    def _ref_dir(self, ref: str) -> Path:
        return self.root / RUNS_DIR / slug(ref)

    @staticmethod
    def _prune(ref_dir: Path, keep_runs: int) -> None:
        runs = sorted(path for path in ref_dir.iterdir() if path.is_dir())
        for old in runs[: max(0, len(runs) - keep_runs)]:
            shutil.rmtree(old)


# ---------------------------------------------------------------- comparison


def p95_of(report: dict[str, Any] | None, scenario: str) -> int | None:
    if report is None:
        return None
    return report.get("latencies", {}).get(scenario, {}).get(COMPARED_METRIC)


def compare_series(
    series: str, runs: list[RecordedRun], current: dict[str, Any], settings: Settings
) -> SeriesResult:
    """`runs` is the history before the current night, oldest first."""
    previous = [run.reports.get(series) for run in runs]
    rows = [
        _compare_scenario(scenario, previous, current, settings) for scenario in _ordered_scenarios(current)
    ]
    return SeriesResult(series, current["benchmarkId"], describe(current), rows)


def _ordered_scenarios(report: dict[str, Any]) -> list[str]:
    """API routes busiest first; lineage scenarios in chart-group order; anything else by name.

    The Java envelope copies its maps with Map.copyOf, so file order carries no meaning.
    """
    latencies = report.get("latencies", {})
    if report["benchmarkId"] == API_LATENCY_ID:
        return sorted(latencies, key=lambda route: (-latencies[route].get("sampleCount", 0), route))
    if report["benchmarkId"] == LINEAGE_SCENE_ID:
        return sorted(latencies, key=lambda scenario: (_group_index(scenario, LINEAGE_GROUPS), scenario))
    return sorted(latencies)


def _group_index(scenario: str, groups: list[ChartGroup]) -> int:
    return next(index for index, (_, matches) in enumerate(groups) if matches(scenario))


def _compare_scenario(
    scenario: str, previous: list[dict[str, Any] | None], current: dict[str, Any], settings: Settings
) -> Row:
    latest = current["latencies"][scenario]
    p95 = latest.get(COMPARED_METRIC)
    samples = latest.get("sampleCount", 0)
    history = [value for value in (p95_of(report, scenario) for report in previous) if value is not None]
    baseline_values = history[-settings.baseline_runs :]
    baseline = statistics.median(baseline_values) if baseline_values else None
    trail = [p95_of(report, scenario) for report in previous][-(settings.window - 1) :] + [p95]
    return Row(
        scenario=scenario,
        p95=p95,
        baseline=baseline,
        change_pct=_percent_change(baseline, p95),
        verdict=_verdict(p95, baseline_values, samples, settings),
        samples=samples,
        sparkline=sparkline(trail),
    )


def _verdict(p95: int | None, baseline_values: list[int], samples: int, settings: Settings) -> str:
    if p95 is None:
        return NOT_MEASURED_LABEL
    if samples < settings.min_samples:
        return FEW_SAMPLES_LABEL
    if len(baseline_values) < settings.min_history:
        return f"{WARMING_UP_LABEL} ({len(baseline_values)}/{settings.min_history})"
    baseline = statistics.median(baseline_values)
    if abs(p95 - baseline) <= settings.noise_floor_ms:
        return UNCHANGED_LABEL
    change = _percent_change(baseline, p95)
    if change is None or change > settings.tolerance_pct:
        return REGRESSED_LABEL
    if change < -settings.tolerance_pct:
        return IMPROVED_LABEL
    return UNCHANGED_LABEL


def _percent_change(baseline: float | None, value: int | None) -> float | None:
    if baseline is None or value is None or baseline == 0:
        return None
    return (value - baseline) / baseline * 100.0


def sparkline(values: list[int | None]) -> str:
    """One glyph per night, scaled between the window's own min and max."""
    present = [value for value in values if value is not None]
    if not present:
        return ""
    low, high = min(present), max(present)
    span = high - low
    glyphs = []
    for value in values:
        if value is None:
            glyphs.append(SPARK_GAP)
        elif span == 0:
            glyphs.append(SPARK_CHARS[len(SPARK_CHARS) // 2])
        else:
            glyphs.append(SPARK_CHARS[round((value - low) / span * (len(SPARK_CHARS) - 1))])
    return "".join(glyphs)


# ---------------------------------------------------------------- markdown


def render_summary(
    info: RunInfo, results: list[SeriesResult], settings: Settings, trends_url: str | None
) -> str:
    run = f"[{info.run_id}]({info.url})" if info.url else info.run_id
    lines = [
        f"## Nightly latency · `{info.ref}` · run {run}",
        "",
        f"_p95 per scenario against the median of the previous {settings.baseline_runs} nights. "
        f"A change is flagged past ±{settings.tolerance_pct:g}% and {settings.noise_floor_ms} ms; "
        f"nothing is judged before {settings.min_history} nights of history. "
        f"Trend: last {settings.window} nights._" + (f" [All trends]({trends_url})." if trends_url else ""),
        "",
    ]
    if not results:
        lines.append("No benchmark reports were produced by this run.")
    for result in results:
        lines.extend(_series_table(result, settings))
    return "\n".join(lines) + "\n"


def _series_table(result: SeriesResult, settings: Settings) -> list[str]:
    is_api = result.benchmark_id == API_LATENCY_ID
    rows = _visible_rows(result, settings) if is_api else result.rows
    header = "| route | calls " if is_api else "| scenario "
    lines = [
        f"### {result.benchmark_id} · {result.description}",
        "",
        header + "| p95 | baseline | change | trend | |",
        "|---|" + ("---:|" if is_api else "") + "---:|---:|---:|---|---|",
    ]
    for row in rows:
        calls = f"| {row.samples:,} " if is_api else ""
        lines.append(
            f"| `{row.scenario}` {calls}| {_ms(row.p95)} | {_ms(row.baseline)} | "
            f"{_pct(row.change_pct)} | {row.sparkline} | {VERDICT_CELLS.get(row.verdict, row.verdict)} |"
        )
    hidden = len(result.rows) - len(rows)
    if hidden > 0:
        lines.append(f"\n_{hidden} quieter routes omitted; every route is on the trends page._")
    lines.append("")
    return lines


def _visible_rows(result: SeriesResult, settings: Settings) -> list[Row]:
    """The busiest routes, plus every regressed one however quiet."""
    busiest = result.rows[: settings.api_rows]
    extra = [row for row in result.regressions if row not in busiest]
    return busiest + extra


def _ms(value: float | None) -> str:
    return "—" if value is None else f"{value:,.0f} ms"


def _pct(change: float | None) -> str:
    return "—" if change is None else f"{change:+.1f}%"


# ---------------------------------------------------------------- trends page


ChartGroup = tuple[str, Callable[[str], bool]]

LINEAGE_GROUPS: list[ChartGroup] = [
    ("Scene API — root scenes", lambda scenario: scenario.startswith("root-")),
    ("Scene API — focused scenes", lambda scenario: scenario.startswith("focused-")),
    ("Lineage map — first render", lambda scenario: scenario.startswith("lineage-map-")),
    (
        "Lineage map — drill and navigate",
        lambda scenario: scenario.startswith(("interaction-drill-", "interaction-breadcrumb-")),
    ),
    ("Lineage map — zoom and view", lambda scenario: scenario.startswith("interaction-")),
    ("Other lineage APIs", lambda scenario: True),
]
DEFAULT_GROUPS: list[ChartGroup] = [("All scenarios", lambda scenario: True)]


def write_trends(history: History, out_dir: Path, settings: Settings, updated_by: RunInfo) -> None:
    """Regenerates TRENDS.md and every chart from the whole history, so the page never drifts."""
    charts_dir = out_dir / CHARTS_DIR
    if charts_dir.exists():
        shutil.rmtree(charts_dir)
    run = f"[{updated_by.run_id}]({updated_by.url})" if updated_by.url else updated_by.run_id
    lines = [
        "# Nightly latency trends",
        "",
        "_Generated by `.github/scripts/benchmark_trend.py` in open-metadata/OpenMetadata from the "
        "`runs/` directory of this branch. Do not edit by hand._",
        "",
        f"Last updated by run {run} on `{updated_by.ref}`. Each chart plots p95 per nightly run "
        f"(last {settings.window} runs); the table under it holds the same values.",
        "",
    ]
    for ref in _refs_main_first(history.refs()):
        lines.extend(_ref_section(ref, history.load(ref)[-settings.window :], charts_dir, settings))
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / TRENDS_FILE).write_text("\n".join(lines) + "\n", encoding="utf-8")


def _refs_main_first(refs: list[str]) -> list[str]:
    return sorted(refs, key=lambda ref: (ref != "main", ref))


def _ref_section(ref: str, runs: list[RecordedRun], charts_dir: Path, settings: Settings) -> list[str]:
    lines = [f"## `{ref}`", ""]
    for series in _ordered_series({key for run in runs for key in run.reports}):
        latest = next(run.reports[series] for run in reversed(runs) if series in run.reports)
        lines.append(f"### {latest['benchmarkId']} · {describe(latest)}")
        lines.append("")
        directory = charts_dir / slug(ref) / slug(series)
        for section in _sections_for(series, latest, runs, settings):
            lines.extend(_section_block(section, directory))
    return lines


@dataclass(frozen=True)
class ChartSection:
    title: str
    charts: list[svg.Chart]


def _sections_for(
    series: str, latest: dict[str, Any], runs: list[RecordedRun], settings: Settings
) -> list[ChartSection]:
    """Small multiples, one chart per scenario on its own scale: a 10 s hub scene and a 10 ms
    cached one cannot share an axis without flattening the fast one into its baseline."""
    labels = [run.info.label for run in runs]
    reports = [run.reports.get(series) for run in runs]
    if latest["benchmarkId"] == API_LATENCY_ID:
        routes = _ordered_scenarios(latest)[: settings.api_charts]
        return [ChartSection("Busiest routes", [_small_multiple(r, reports, labels) for r in routes])]
    groups = LINEAGE_GROUPS if latest["benchmarkId"] == LINEAGE_SCENE_ID else DEFAULT_GROUPS
    remaining = _ordered_scenarios(latest)
    sections = []
    for title, matches in groups:
        members = [scenario for scenario in remaining if matches(scenario)]
        remaining = [scenario for scenario in remaining if scenario not in members]
        if members:
            sections.append(ChartSection(title, [_small_multiple(m, reports, labels) for m in members]))
    return sections


def _small_multiple(scenario: str, reports: list[dict[str, Any] | None], labels: list[str]) -> svg.Chart:
    return svg.Chart(
        scenario,
        labels,
        [svg.Series(scenario, [p95_of(report, scenario) for report in reports])],
        width=SMALL_MULTIPLE_WIDTH,
        plot_height=SMALL_MULTIPLE_PLOT_HEIGHT,
    )


def _section_block(section: ChartSection, directory: Path) -> list[str]:
    # One HTML block with no blank lines inside, so GitHub flows the charts two to a row.
    pictures = [_picture(chart, directory) for chart in section.charts]
    return [f"#### {section.title}", "", "\n".join(pictures), "", *_value_table(section), ""]


def _picture(chart: svg.Chart, directory: Path) -> str:
    directory.mkdir(parents=True, exist_ok=True)
    stem = slug(chart.title)
    for theme in svg.THEMES:
        (directory / f"{stem}.{theme}.svg").write_text(svg.render(chart, theme), encoding="utf-8")
    relative = f"{CHARTS_DIR}/{directory.parent.name}/{directory.name}/{stem}"
    alt = escape(f"{chart.title}: p95 per nightly run", quote=True)
    return (
        f'<picture><source media="(prefers-color-scheme: dark)" srcset="{relative}.dark.svg">'
        f'<img alt="{alt}" src="{relative}.light.svg" width="{chart.width}"></picture>'
    )


def _value_table(section: ChartSection) -> list[str]:
    """The charts' own numbers, so no value is reachable only by reading a line."""
    names = [chart.title for chart in section.charts]
    labels = section.charts[0].run_labels if section.charts else []
    lines = [
        "<details><summary>Values</summary>",
        "",
        "| run | " + " | ".join(f"`{name}`" for name in names) + " |",
        "|---|" + "---:|" * len(names),
    ]
    for index, label in enumerate(labels):
        cells = [_ms(chart.series[0].values[index]) for chart in section.charts]
        lines.append(f"| {label} | " + " | ".join(cells) + " |")
    lines.extend(["", "</details>", ""])
    return lines


def _ordered_series(keys: set[str]) -> list[str]:
    """The lineage benchmark leads; per-suite API traffic follows."""
    return sorted(keys, key=lambda key: (key.startswith(API_LATENCY_ID), key))


# ---------------------------------------------------------------- slack


def render_slack(
    info: RunInfo, results: list[SeriesResult], trends_url: str | None, max_listed: int = 10
) -> dict[str, Any]:
    regressions = [(result, row) for result in results for row in result.regressions]
    headline = (
        f"Nightly latency · {info.ref}: {len(regressions)} regression(s)"
        if regressions
        else f"Nightly latency · {info.ref}: no regressions"
    )
    blocks: list[dict[str, Any]] = [
        {"type": "header", "text": {"type": "plain_text", "text": headline}},
        {"type": "section", "text": {"type": "mrkdwn", "text": _slack_overview(results)}},
    ]
    if regressions:
        blocks.append(
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": _slack_regressions(regressions, max_listed)},
            }
        )
    blocks.append(
        {"type": "context", "elements": [{"type": "mrkdwn", "text": _slack_links(info, trends_url)}]}
    )
    return {"text": headline, "blocks": blocks}


def _slack_overview(results: list[SeriesResult]) -> str:
    if not results:
        return "No benchmark reports were produced by this run."
    lines = []
    for result in results:
        counts = {label: 0 for label in (REGRESSED_LABEL, IMPROVED_LABEL, UNCHANGED_LABEL)}
        for row in result.rows:
            if row.verdict in counts:
                counts[row.verdict] += 1
        judged = sum(counts.values())
        lines.append(
            f"• *{result.benchmark_id}* ({result.description.replace('`', '')}): "
            f"{counts[REGRESSED_LABEL]} slower, {counts[IMPROVED_LABEL]} faster, "
            f"{counts[UNCHANGED_LABEL]} unchanged"
            + (f", {len(result.rows) - judged} not yet judged" if judged < len(result.rows) else "")
        )
    return "\n".join(lines)


def _slack_regressions(regressions: list[tuple[SeriesResult, Row]], max_listed: int) -> str:
    lines = ["*Slower than the recent median:*"]
    for result, row in regressions[:max_listed]:
        lines.append(
            f"• `{row.scenario}` ({result.benchmark_id}) {_ms(row.p95)} vs {_ms(row.baseline)} "
            f"({_pct(row.change_pct)}) {row.sparkline}"
        )
    if len(regressions) > max_listed:
        lines.append(f"…and {len(regressions) - max_listed} more in the run summary.")
    return "\n".join(lines)


def _slack_links(info: RunInfo, trends_url: str | None) -> str:
    links = []
    if info.url:
        links.append(f"<{info.url}|Run {info.run_id}>")
    if trends_url:
        links.append(f"<{trends_url}|Trends>")
    return " · ".join(links) or f"Run {info.run_id}"


# ---------------------------------------------------------------- cli


def compare_run(
    history: History, info: RunInfo, reports: list[dict[str, Any]], settings: Settings
) -> list[SeriesResult]:
    """Compares the current reports with history recorded before this run."""
    previous = [run for run in history.load(info.ref) if run.info.run_id != info.run_id]
    by_series = {series_key(report): report for report in reports}
    return [
        compare_series(series, previous, by_series[series], settings)
        for series in _ordered_series(set(by_series))
    ]


def gated_regressions(results: list[SeriesResult], gates: list[str]) -> list[tuple[str, Row]]:
    return [
        (result.series, row)
        for result in results
        if result.benchmark_id in gates
        for row in result.regressions
    ]


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--reports", type=Path, action="append", required=True, help="dir or file; repeatable"
    )
    parser.add_argument("--history", type=Path, required=True, help="benchmark-history checkout")
    parser.add_argument("--ref", required=True, help="branch the run built, e.g. main")
    parser.add_argument("--run-id", default="local")
    parser.add_argument("--run-url")
    parser.add_argument("--run-started-at", help="ISO-8601; defaults to now")
    parser.add_argument("--record", action="store_true", help="add this run to the history")
    parser.add_argument("--keep-runs", type=int, default=120, help="history kept per ref")
    parser.add_argument("--write-trends", action="store_true", help="regenerate TRENDS.md + charts")
    parser.add_argument("--trends-url", help="where TRENDS.md is browsable, for links")
    parser.add_argument("--summary-out", type=Path, help="append the markdown summary here")
    parser.add_argument("--slack-out", type=Path, help="write a Slack chat.postMessage payload")
    parser.add_argument("--json-out", type=Path, help="write the comparison as JSON")
    parser.add_argument("--gate", action="append", default=[], help="benchmarkId whose regressions fail")
    parser.add_argument("--fail-on-regression", action="store_true")
    defaults = Settings()
    for name in (
        "baseline_runs",
        "min_history",
        "noise_floor_ms",
        "min_samples",
        "window",
        "api_rows",
        "api_charts",
    ):
        parser.add_argument(f"--{name.replace('_', '-')}", type=int, default=getattr(defaults, name))
    parser.add_argument("--tolerance-pct", type=float, default=defaults.tolerance_pct)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    settings = Settings(
        baseline_runs=args.baseline_runs,
        min_history=args.min_history,
        tolerance_pct=args.tolerance_pct,
        noise_floor_ms=args.noise_floor_ms,
        min_samples=args.min_samples,
        window=args.window,
        api_rows=args.api_rows,
        api_charts=args.api_charts,
    )
    try:
        reports = load_reports(args.reports)
    except ComparisonError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    info = RunInfo(
        run_id=str(args.run_id),
        started_at=args.run_started_at or datetime.now(timezone.utc).isoformat(),
        ref=args.ref,
        url=args.run_url,
        git_sha=next((r.get("gitSha") for r in reports if r.get("gitSha") not in (None, UNKNOWN)), None),
    )
    history = History(args.history)
    results = compare_run(history, info, reports, settings)
    if args.record and reports:
        history.record(info, reports, args.keep_runs)
    if args.write_trends:
        write_trends(history, args.history, settings, info)
    _write_outputs(args, info, results, settings)
    return _exit_code(results, args.gate, args.fail_on_regression)


def _write_outputs(
    args: argparse.Namespace, info: RunInfo, results: list[SeriesResult], settings: Settings
) -> None:
    summary = render_summary(info, results, settings, args.trends_url)
    if args.summary_out:
        with args.summary_out.open("a", encoding="utf-8") as out:
            out.write(summary)
    else:
        print(summary)
    if args.slack_out:
        args.slack_out.write_text(json.dumps(render_slack(info, results, args.trends_url), indent=2))
    if args.json_out:
        args.json_out.write_text(json.dumps([asdict(result) for result in results], indent=2))


def _exit_code(results: list[SeriesResult], gates: list[str], fail_on_regression: bool) -> int:
    failures = gated_regressions(results, gates)
    for series, row in failures:
        print(
            f"regression: {series} {row.scenario} p95 {_ms(row.p95)} vs median {_ms(row.baseline)} "
            f"({_pct(row.change_pct)})",
            file=sys.stderr,
        )
    return 1 if (fail_on_regression and failures) else 0


if __name__ == "__main__":
    raise SystemExit(main())
