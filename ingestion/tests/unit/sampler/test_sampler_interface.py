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
import pytest

from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.constants import SAMPLE_DATA_MAX_CELL_LENGTH


class TestTruncateCell:
    @pytest.mark.parametrize(
        "value,expected",
        [
            ("short string", "short string"),
            (12345, 12345),
            (None, None),
            (True, True),
            (3.14, 3.14),
            (b"bytes", b"bytes"),
        ],
    )
    def test_non_oversized_values_pass_through(self, value, expected):
        assert SamplerInterface._truncate_cell(value) == expected

    def test_string_at_limit_is_not_truncated(self):
        value = "a" * SAMPLE_DATA_MAX_CELL_LENGTH
        result = SamplerInterface._truncate_cell(value)
        assert result == value
        assert len(result) == SAMPLE_DATA_MAX_CELL_LENGTH

    def test_string_over_limit_is_truncated(self):
        value = "a" * (SAMPLE_DATA_MAX_CELL_LENGTH + 500)
        result = SamplerInterface._truncate_cell(value)
        assert len(result) == SAMPLE_DATA_MAX_CELL_LENGTH

    def test_truncation_preserves_prefix(self):
        prefix = "important_data_"
        value = prefix + "x" * SAMPLE_DATA_MAX_CELL_LENGTH
        result = SamplerInterface._truncate_cell(value)
        assert result.startswith(prefix)
        assert len(result) == SAMPLE_DATA_MAX_CELL_LENGTH

    def test_very_large_string_is_truncated(self):
        value = "z" * 10_000_000
        result = SamplerInterface._truncate_cell(value)
        assert len(result) == SAMPLE_DATA_MAX_CELL_LENGTH
