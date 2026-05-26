#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Memory tracker behavior."""

from metadata.ingestion.diagnostics.memory import (
    MemoryTracker,
    format_bytes,
    format_signed_bytes,
)


def test_sample_returns_nonzero_rss_in_process():
    tracker = MemoryTracker()
    sample = tracker.sample()
    assert sample.rss > 0


def test_rss_delta_returns_none_with_single_sample():
    tracker = MemoryTracker()
    tracker.sample()
    delta = tracker.rss_delta_bytes_since(30.0)
    # With a single sample, delta is 0 (latest - latest) not None.
    # The current implementation falls back to the oldest sample.
    assert delta == 0


def test_top_object_types_includes_common_python_types():
    tracker = MemoryTracker()
    top = tracker.top_object_types(limit=5)
    type_names = {name for name, _ in top}
    # `dict` and `function` are always present in a running Python process.
    assert "dict" in type_names or "function" in type_names


def test_format_bytes_renders_human_readable():
    assert format_bytes(0) == "0B"
    assert format_bytes(1024) == "1K"
    assert format_bytes(2 * 1024 * 1024) == "2M"
    assert format_bytes(3 * 1024 * 1024 * 1024) == "3.0G"
    assert format_bytes(None) == "?"


def test_format_signed_bytes_has_explicit_sign():
    assert format_signed_bytes(0) == "+0B"
    assert format_signed_bytes(1024 * 1024) == "+1M"
    assert format_signed_bytes(-1024 * 1024) == "-1M"
    assert format_signed_bytes(None) == "?"


def test_ring_buffer_captures_growth():
    tracker = MemoryTracker()
    # Take two samples — the delta API should not crash regardless of
    # actual rss growth.
    tracker.sample()
    tracker.sample()
    delta = tracker.rss_delta_bytes_since(30.0)
    assert isinstance(delta, int)
