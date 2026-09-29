"""Rerun-failed-jobs attempts must keep earlier green shards and drop superseded ones."""

import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).parents[1]


def load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_keeps_newest_attempt_per_shard(tmp_path):
    names = [
        "playwright-results-json-chromium-01-a1",
        "playwright-results-json-chromium-14-a1",
        "playwright-results-json-chromium-14-a1-retry",
        "playwright-results-json-chromium-14-a2",
        "playwright-results-json-chromium-14-a2-retry",
        "playwright-results-json-advanced-search-01",
        "playwright-results-json-advanced-search-01-a3",
        "playwright-blob-chromium-14",
    ]
    for name in names:
        (tmp_path / name).mkdir()

    load_script("keep_latest_playwright_attempt").keep_latest_attempt(tmp_path)

    assert sorted(p.name for p in tmp_path.iterdir()) == [
        "playwright-blob-chromium-14",
        "playwright-results-json-advanced-search-01-a3",
        "playwright-results-json-chromium-01-a1",
        "playwright-results-json-chromium-14-a2",
        "playwright-results-json-chromium-14-a2-retry",
    ]


def test_missing_results_dir_is_a_no_op(tmp_path):
    module = load_script("keep_latest_playwright_attempt")
    assert module.keep_latest_attempt(tmp_path / "absent") == []
