"""Static SVG line charts for benchmark_trend.py — no dependencies, GitHub-renderable.

GitHub serves images in markdown sanitised and script-free, so these are plain SVG: one file per
colour scheme, picked by a <picture> element in TRENDS.md. Hover is not possible in that setting;
each point still carries a <title> for anyone opening the SVG itself, and TRENDS.md prints every
plotted value in a table next to the chart.

The palette, ink and mark specs follow the data-viz reference instance (validated light and dark):
categorical hues in fixed order, never cycled — a group with more than eight series is split by
the caller — 2px round lines, r=4 end dots with a 2px surface ring, solid hairline grid.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from html import escape

MAX_SERIES_PER_CHART = 8

THEMES = {
    "light": {
        "surface": "#fcfcfb",
        "text_primary": "#0b0b0b",
        "text_secondary": "#52514e",
        "text_muted": "#898781",
        "grid": "#e1e0d9",
        "axis": "#c3c2b7",
        "series": ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
    },
    "dark": {
        "surface": "#1a1a19",
        "text_primary": "#ffffff",
        "text_secondary": "#c3c2b7",
        "text_muted": "#898781",
        "grid": "#2c2c2a",
        "axis": "#383835",
        "series": ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
    },
}

FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
DEFAULT_WIDTH = 760
DEFAULT_PLOT_HEIGHT = 200
MARGIN_LEFT = 80
MARGIN_RIGHT = 76
MARGIN_TOP = 16
AXIS_BAND = 34
LEGEND_ROW = 22
LEGEND_COLUMNS = 2
Y_TICKS = 4
X_LABEL_SPACING = 110
TITLE_CHAR_WIDTH = 7.2
DIRECT_LABEL_MAX_SERIES = 4
DIRECT_LABEL_MIN_GAP = 14


@dataclass(frozen=True)
class Series:
    """One line: its name and one value per run (None where the run did not measure it)."""

    name: str
    values: list[float | None]


@dataclass(frozen=True)
class Chart:
    title: str
    run_labels: list[str]
    series: list[Series]
    unit: str = "ms"
    width: int = DEFAULT_WIDTH
    plot_height: int = DEFAULT_PLOT_HEIGHT


def render(chart: Chart, theme_name: str) -> str:
    """The chart as a standalone SVG document in the given colour scheme."""
    if len(chart.series) > MAX_SERIES_PER_CHART:
        raise ValueError(
            f"{chart.title}: {len(chart.series)} series; split the group so no chart needs a "
            f"{MAX_SERIES_PER_CHART + 1}th hue"
        )
    theme = THEMES[theme_name]
    legend_rows = math.ceil(len(chart.series) / LEGEND_COLUMNS) if len(chart.series) > 1 else 0
    height = MARGIN_TOP + 22 + chart.plot_height + AXIS_BAND + legend_rows * LEGEND_ROW + 8
    top = MARGIN_TOP + 22
    scale = _Scale(chart, top)
    parts = [
        _open_svg(chart.width, height, chart.title, theme),
        _title(chart, theme),
        _grid(scale, theme, chart.unit),
        _x_labels(scale, chart.run_labels, theme),
    ]
    for index, series in enumerate(chart.series):
        parts.append(_line(scale, series, theme["series"][index], theme, chart.run_labels, chart.unit))
    parts.append(_direct_labels(scale, chart.series, theme, chart.unit))
    parts.append(_legend(chart, theme, top + chart.plot_height + AXIS_BAND))
    parts.append("</svg>\n")
    return "".join(parts)


class _Scale:
    def __init__(self, chart: Chart, top: int) -> None:
        self.top = top
        self.bottom = top + chart.plot_height
        self.left = MARGIN_LEFT
        self.right = chart.width - MARGIN_RIGHT
        self.count = max(1, len(chart.run_labels))
        observed = [v for s in chart.series for v in s.values if v is not None]
        highest = max(observed) if observed else 1
        self.step = nice_step(highest / Y_TICKS)
        self.ticks = max(1, math.ceil(highest / self.step))
        self.max_value = self.step * self.ticks

    def x(self, index: int) -> float:
        if self.count == 1:
            return (self.left + self.right) / 2
        return self.left + (self.right - self.left) * index / (self.count - 1)

    def y(self, value: float) -> float:
        return self.bottom - (self.bottom - self.top) * (value / self.max_value)


def nice_step(value: float) -> float:
    """The smallest 1/2/5 x 10^k at or above `value`, so every tick lands on a round number."""
    if value <= 0:
        return 1
    magnitude = 10 ** math.floor(math.log10(value))
    for multiple in (1, 2, 5, 10):
        if value <= multiple * magnitude:
            return multiple * magnitude
    return 10 * magnitude


def format_value(value: float, unit: str) -> str:
    return f"{value:,.0f} {unit}" if value >= 10 or value == 0 else f"{value:,.1f} {unit}"


def _open_svg(width: int, height: int, title: str, theme: dict) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" aria-label="{escape(title)}" '
        f"font-family='{FONT}'>"
        f'<rect width="{width}" height="{height}" rx="8" fill="{theme["surface"]}"/>'
    )


def _title(chart: Chart, theme: dict) -> str:
    """Shortened with an ellipsis to the chart's width; the full name stays in aria-label."""
    room = int((chart.width - 2 * 16) / TITLE_CHAR_WIDTH)
    title = chart.title if len(chart.title) <= room else chart.title[: room - 1] + "…"
    return (
        f'<text x="16" y="{MARGIN_TOP + 8}" font-size="13" font-weight="600" '
        f'fill="{theme["text_primary"]}">{escape(title)}</text>'
    )


def _grid(scale: _Scale, theme: dict, unit: str) -> str:
    lines = []
    for tick in range(scale.ticks + 1):
        value = scale.step * tick
        y = scale.y(value)
        colour = theme["axis"] if tick == 0 else theme["grid"]
        lines.append(
            f'<line x1="{scale.left}" x2="{scale.right}" y1="{y:.1f}" y2="{y:.1f}" '
            f'stroke="{colour}" stroke-width="1"/>'
            f'<text x="{scale.left - 8}" y="{y + 4:.1f}" font-size="11" text-anchor="end" '
            f'fill="{theme["text_muted"]}" style="font-variant-numeric: tabular-nums">'
            f"{escape(format_value(value, unit))}</text>"
        )
    return "".join(lines)


def _x_labels(scale: _Scale, labels: list[str], theme: dict) -> str:
    if not labels:
        return ""
    room = max(2, int((scale.right - scale.left) / X_LABEL_SPACING) + 1)
    stride = max(1, math.ceil(len(labels) / room))
    picked = list(range(0, len(labels), stride))
    last = len(labels) - 1
    if picked[-1] != last:
        # The newest night is always labelled; a strided label too close to it gives way.
        if len(picked) > 1 and last - picked[-1] < stride / 2:
            picked[-1] = last
        else:
            picked.append(last)
    return "".join(
        f'<text x="{scale.x(index):.1f}" y="{scale.bottom + 18}" font-size="11" '
        f'text-anchor="middle" fill="{theme["text_muted"]}">{escape(labels[index])}</text>'
        for index in picked
    )


def _segments(scale: _Scale, values: list[float | None]) -> list[list[tuple[float, float]]]:
    """Consecutive measured points; a missing run breaks the line instead of bridging it."""
    segments: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for index, value in enumerate(values):
        if value is None:
            if current:
                segments.append(current)
            current = []
            continue
        current.append((scale.x(index), scale.y(value)))
    if current:
        segments.append(current)
    return segments


def _line(scale: _Scale, series: Series, colour: str, theme: dict, labels: list[str], unit: str) -> str:
    parts = []
    for segment in _segments(scale, series.values):
        points = " ".join(f"{x:.1f},{y:.1f}" for x, y in segment)
        parts.append(
            f'<polyline points="{points}" fill="none" stroke="{colour}" stroke-width="2" '
            f'stroke-linejoin="round" stroke-linecap="round"/>'
        )
    parts.extend(_point_titles(scale, series, labels, unit))
    last = _last_point(series.values)
    if last is not None:
        index, value = last
        parts.append(
            f'<circle cx="{scale.x(index):.1f}" cy="{scale.y(value):.1f}" r="4" fill="{colour}" '
            f'stroke="{theme["surface"]}" stroke-width="2"/>'
        )
    return "".join(parts)


def _point_titles(scale: _Scale, series: Series, labels: list[str], unit: str) -> list[str]:
    """Invisible hit targets carrying the exact value, readable when the SVG is opened directly."""
    titles = []
    for index, value in enumerate(series.values):
        if value is None:
            continue
        label = labels[index] if index < len(labels) else str(index)
        titles.append(
            f'<circle cx="{scale.x(index):.1f}" cy="{scale.y(value):.1f}" r="8" fill="transparent">'
            f"<title>{escape(series.name)} · {escape(label)}: {escape(format_value(value, unit))}"
            f"</title></circle>"
        )
    return titles


def _last_point(values: list[float | None]) -> tuple[int, float] | None:
    for index in range(len(values) - 1, -1, -1):
        if values[index] is not None:
            return index, values[index]
    return None


def _direct_labels(scale: _Scale, series_list: list[Series], theme: dict, unit: str) -> str:
    """Latest value at each line's end — only when few enough lines end far enough apart."""
    if len(series_list) > DIRECT_LABEL_MAX_SERIES:
        return ""
    ends = [(_last_point(s.values), s) for s in series_list]
    ys = sorted(scale.y(point[1]) for point, _ in ends if point is not None)
    if any(b - a < DIRECT_LABEL_MIN_GAP for a, b in zip(ys, ys[1:], strict=False)):
        return ""
    labels = []
    for point, _series in ends:
        if point is None:
            continue
        index, value = point
        labels.append(
            f'<text x="{scale.x(index) + 10:.1f}" y="{scale.y(value) + 4:.1f}" font-size="11" '
            f'fill="{theme["text_secondary"]}" style="font-variant-numeric: tabular-nums">'
            f"{escape(format_value(value, unit))}</text>"
        )
    return "".join(labels)


def _legend(chart: Chart, theme: dict, top: int) -> str:
    if len(chart.series) < 2:
        return ""
    column_width = (chart.width - MARGIN_LEFT - MARGIN_RIGHT) / LEGEND_COLUMNS
    parts = []
    for index, series in enumerate(chart.series):
        row, column = divmod(index, LEGEND_COLUMNS)
        x = MARGIN_LEFT + column * column_width
        y = top + row * LEGEND_ROW + 6
        parts.append(
            f'<line x1="{x:.1f}" x2="{x + 16:.1f}" y1="{y:.1f}" y2="{y:.1f}" '
            f'stroke="{theme["series"][index]}" stroke-width="2" stroke-linecap="round"/>'
            f'<text x="{x + 22:.1f}" y="{y + 4:.1f}" font-size="12" '
            f'fill="{theme["text_secondary"]}">{escape(series.name)}</text>'
        )
    return "".join(parts)
