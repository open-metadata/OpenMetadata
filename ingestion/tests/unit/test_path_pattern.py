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

"""
Tests for path_pattern.py — glob matching, partition detection, table grouping.
"""

from metadata.generated.schema.entity.data.table import DataType
from metadata.utils.path_pattern import (
    detect_hive_partitions,
    extract_static_prefix,
    extract_table_root,
    group_files_by_table,
    infer_structure_format,
    pattern_to_regex,
)


class TestExtractStaticPrefix:
    def test_wildcard_at_second_level(self):
        assert extract_static_prefix("data/*/events/*.parquet") == "data/"

    def test_wildcard_at_first_level(self):
        assert extract_static_prefix("*/*.csv") == ""

    def test_no_wildcards(self):
        assert extract_static_prefix("data/events/file.parquet") == "data/events/file.parquet"

    def test_deep_static_prefix(self):
        assert extract_static_prefix("data/events/*.parquet") == "data/events/"

    def test_double_star(self):
        assert extract_static_prefix("data/**/*.json") == "data/"

    def test_empty_pattern(self):
        assert extract_static_prefix("") == ""

    def test_just_wildcard(self):
        assert extract_static_prefix("*.csv") == ""

    def test_question_mark_wildcard(self):
        assert extract_static_prefix("data/202?/*.parquet") == "data/"

    def test_bracket_not_treated_as_wildcard(self):
        """Bracket character classes are not supported in patterns."""
        assert extract_static_prefix("data/[abc]/*.parquet") == "data/[abc]/"


class TestPatternToRegex:
    def test_single_star_matches_one_level(self):
        regex = pattern_to_regex("data/*/events/*.parquet")
        assert regex.match("data/warehouse/events/file.parquet")
        assert not regex.match("data/a/b/events/file.parquet")

    def test_double_star_matches_multiple_levels(self):
        regex = pattern_to_regex("data/**/*.json")
        assert regex.match("data/a/b/c/file.json")
        assert regex.match("data/file.json")

    def test_exact_match(self):
        regex = pattern_to_regex("data/events/file.parquet")
        assert regex.match("data/events/file.parquet")
        assert not regex.match("data/events/other.parquet")

    def test_extension_filter(self):
        regex = pattern_to_regex("data/*/*.parquet")
        assert regex.match("data/folder/file.parquet")
        assert not regex.match("data/folder/file.csv")

    def test_question_mark(self):
        regex = pattern_to_regex("data/202?/*.parquet")
        assert regex.match("data/2024/file.parquet")
        assert not regex.match("data/20245/file.parquet")

    def test_does_not_match_partial(self):
        regex = pattern_to_regex("data/*/events/*.parquet")
        assert not regex.match("data/warehouse/events/file.parquet.bak")

    def test_special_characters_escaped(self):
        regex = pattern_to_regex("data/events.v2/*.parquet")
        assert regex.match("data/events.v2/file.parquet")
        assert not regex.match("data/eventsXv2/file.parquet")

    # --- Edge cases from code review ---

    def test_star_matches_zero_chars(self):
        """Bug fix: * should match zero or more chars (not one or more).
        data*.parquet should match data.parquet."""
        regex = pattern_to_regex("data*.parquet")
        assert regex.match("data.parquet")
        assert regex.match("data_v2.parquet")

    def test_double_star_at_start_matches_root(self):
        """Bug fix: **/*.parquet at start should match file.parquet
        (zero-depth path with no directory)."""
        regex = pattern_to_regex("**/*.parquet")
        assert regex.match("file.parquet")
        assert regex.match("data/file.parquet")
        assert regex.match("a/b/c/file.parquet")

    def test_double_star_at_end(self):
        """** at end should match zero or more trailing segments."""
        regex = pattern_to_regex("data/**")
        assert regex.match("data/file.parquet")
        assert regex.match("data/a/b/file.parquet")
        # data/ alone is a directory marker, filtered by list_keys before matching

    def test_star_matches_empty_segment_in_prefix(self):
        """prefix*suffix should match when wildcard portion is empty."""
        regex = pattern_to_regex("logs/*.csv")
        assert regex.match("logs/file.csv")
        assert regex.match("logs/.csv")  # empty name before .csv


class TestExtractTableRoot:
    def test_with_hive_partitions(self):
        assert extract_table_root("data/events/year=2024/month=01/file.parquet") == "data/events"

    def test_with_multiple_partitions(self):
        assert extract_table_root("data/events/year=2024/month=01/day=15/file.parquet") == "data/events"

    def test_without_partitions(self):
        assert extract_table_root("data/events/file.parquet") == "data/events"

    def test_root_level_file(self):
        assert extract_table_root("file.parquet") == ""

    def test_single_directory(self):
        assert extract_table_root("events/file.parquet") == "events"

    def test_partition_at_root(self):
        assert extract_table_root("year=2024/month=01/file.parquet") == ""

    def test_deep_nesting_no_partition(self):
        assert extract_table_root("a/b/c/d/file.parquet") == "a/b/c/d"

    def test_matches_manifest_datapath(self):
        """Table root must match what users put in manifest dataPath."""
        assert extract_table_root("data/events/year=2024/month=01/part-00000.parquet") == "data/events"

    def test_date_prefix_partition(self):
        """Non-Hive date prefix like 20230412 should be treated as partition."""
        assert extract_table_root("cities_multiple_simple/20230412/State=AL/file.parquet") == "cities_multiple_simple"

    def test_date_with_dashes_partition(self):
        """Date with dashes like 2024-01-15 should be treated as partition."""
        assert extract_table_root("data/events/2024-01-15/file.parquet") == "data/events"

    def test_timestamp_partition(self):
        """Timestamp like 20240115T000000Z should be treated as partition."""
        assert extract_table_root("data/logs/20240115T120000Z/file.json") == "data/logs"

    def test_mixed_non_hive_and_hive(self):
        """Date prefix followed by Hive partition."""
        assert extract_table_root("data/events/20230412/State=AL/file.parquet") == "data/events"

    def test_short_number_not_treated_as_partition(self):
        """Short numbers like 'v2' or directory names should NOT be partitions."""
        assert extract_table_root("data/v2/file.parquet") == "data/v2"

    def test_four_digit_year_alone_not_partition(self):
        """Four digits alone like '2024' is ambiguous — could be year partition."""
        # We treat 8+ digits as partition but not 4 digits alone
        assert extract_table_root("data/2024/file.parquet") == "data/2024"


class TestDetectHivePartitions:
    def test_basic_int_partitions(self):
        keys = [
            "root/year=2024/month=01/f.parquet",
            "root/year=2023/month=12/f.parquet",
            "root/year=2024/month=06/f.parquet",
        ]
        columns = detect_hive_partitions(keys, "root")
        assert columns is not None
        assert len(columns) == 2
        assert columns[0].name.root == "year"
        assert columns[0].dataType == DataType.INT
        assert columns[1].name.root == "month"
        assert columns[1].dataType == DataType.INT

    def test_date_partition(self):
        keys = [
            "data/date=2024-01-15/f.parquet",
            "data/date=2024-02-20/f.parquet",
        ]
        columns = detect_hive_partitions(keys, "data")
        assert columns is not None
        assert len(columns) == 1
        assert columns[0].name.root == "date"
        assert columns[0].dataType == DataType.DATE

    def test_string_partition(self):
        keys = [
            "data/region=us-east-1/f.parquet",
            "data/region=eu-west-1/f.parquet",
        ]
        columns = detect_hive_partitions(keys, "data")
        assert columns is not None
        assert len(columns) == 1
        assert columns[0].name.root == "region"
        assert columns[0].dataType == DataType.VARCHAR

    def test_mixed_int_and_string(self):
        keys = [
            "data/year=2024/country=US/f.parquet",
            "data/year=2023/country=UK/f.parquet",
        ]
        columns = detect_hive_partitions(keys, "data")
        assert columns is not None
        assert len(columns) == 2
        assert columns[0].dataType == DataType.INT
        assert columns[1].dataType == DataType.VARCHAR

    def test_no_partitions(self):
        keys = [
            "data/subdir/f.parquet",
            "data/other/f.parquet",
        ]
        columns = detect_hive_partitions(keys, "data")
        assert columns is None

    def test_inconsistent_partitions_returns_none(self):
        keys = [
            "data/year=2024/month=01/f.parquet",
            "data/country=US/f.parquet",
        ]
        columns = detect_hive_partitions(keys, "data")
        assert columns is None

    def test_empty_keys(self):
        assert detect_hive_partitions([], "root") is None

    def test_deeply_nested_partitions(self):
        keys = [
            "lake/events/year=2024/month=01/day=15/hour=00/f.parquet",
            "lake/events/year=2024/month=01/day=15/hour=12/f.parquet",
        ]
        columns = detect_hive_partitions(keys, "lake/events")
        assert columns is not None
        assert len(columns) == 4
        assert [c.name.root for c in columns] == ["year", "month", "day", "hour"]

    def test_single_partition(self):
        keys = [
            "data/state=AL/cities.parquet",
            "data/state=AZ/cities.parquet",
        ]
        columns = detect_hive_partitions(keys, "data")
        assert columns is not None
        assert len(columns) == 1
        assert columns[0].name.root == "state"
        assert columns[0].dataType == DataType.VARCHAR


class TestGroupFilesByTable:
    def test_groups_by_partition_root(self):
        keys = [
            ("data/events/year=2024/month=01/a.parquet", 100),
            ("data/events/year=2024/month=02/b.parquet", 200),
            ("data/users/c.parquet", 300),
        ]
        groups = group_files_by_table(keys)
        assert len(groups) == 2
        assert "data/events" in groups
        assert "data/users" in groups
        assert len(groups["data/events"]) == 2
        assert len(groups["data/users"]) == 1

    def test_root_level_files_grouped_separately(self):
        keys = [
            ("a.parquet", 100),
            ("b.parquet", 200),
        ]
        groups = group_files_by_table(keys)
        assert len(groups) == 1
        assert "" in groups
        assert len(groups[""]) == 2

    def test_mixed_partitioned_and_flat(self):
        keys = [
            ("data/events/year=2024/f.parquet", 100),
            ("data/events/standalone.parquet", 200),
        ]
        groups = group_files_by_table(keys)
        # Both should group under "data/events"
        assert len(groups) == 1
        assert "data/events" in groups

    def test_multiple_tables(self):
        keys = [
            ("data/sales/region=US/f.parquet", 100),
            ("data/sales/region=EU/f.parquet", 200),
            ("data/orders/year=2024/f.parquet", 300),
            ("data/users/profile.parquet", 400),
        ]
        groups = group_files_by_table(keys)
        assert len(groups) == 3
        assert set(groups.keys()) == {"data/sales", "data/orders", "data/users"}


class TestInferStructureFormat:
    """Format auto-detection from file extensions."""

    def test_parquet(self):
        assert infer_structure_format("data/events/file.parquet") == "parquet"

    def test_parquet_pq(self):
        assert infer_structure_format("data/file.pq") == "parquet"

    def test_csv(self):
        assert infer_structure_format("transactions/data.csv") == "csv"

    def test_tsv(self):
        assert infer_structure_format("data.tsv") == "tsv"

    def test_json(self):
        assert infer_structure_format("events/log.json") == "json"

    def test_jsonl(self):
        assert infer_structure_format("stream.jsonl") == "json"

    def test_avro(self):
        assert infer_structure_format("schema/data.avro") == "avro"

    def test_csv_gz(self):
        assert infer_structure_format("compressed/data.csv.gz") == "csv"

    def test_json_gz(self):
        assert infer_structure_format("logs/app.json.gz") == "json"

    def test_unknown_extension(self):
        assert infer_structure_format("image.png") is None

    def test_no_extension(self):
        assert infer_structure_format("README") is None

    def test_case_insensitive(self):
        assert infer_structure_format("Data.PARQUET") == "parquet"

    def test_parquet_snappy_compound(self):
        assert infer_structure_format("data.parquet.snappy") == "parquet"

    def test_parquet_plain(self):
        assert infer_structure_format("data.parquet") == "parquet"


class TestEndToEndDiscovery:
    """Simulate the full discovery flow: pattern match -> group -> partition detect."""

    def test_full_flow_parquet_with_partitions(self):
        pattern = "data/*/events/**/*.parquet"
        regex = pattern_to_regex(pattern)

        all_keys = [
            "data/warehouse/events/year=2024/month=01/part-00000.parquet",
            "data/warehouse/events/year=2024/month=02/part-00000.parquet",
            "data/warehouse/events/year=2023/month=12/part-00000.parquet",
            "data/warehouse/logs/app.log",
            "data/archive/events/year=2022/month=06/part-00000.parquet",
            "other/file.csv",
        ]

        matched = [(k, 1000) for k in all_keys if regex.match(k)]
        assert len(matched) == 4

        groups = group_files_by_table(matched)
        assert "data/warehouse/events" in groups
        assert "data/archive/events" in groups

        for table_root, files in groups.items():
            partitions = detect_hive_partitions([k for k, _ in files], table_root)
            assert partitions is not None
            assert len(partitions) == 2
            assert partitions[0].name.root == "year"
            assert partitions[1].name.root == "month"
