import pytest

from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.source.dashboard.powerbi.client import PowerBiApiClient

# Test cases dictionary
test_cases = {
    "exact_match": {
        "input": FilterPattern(includes=["^exact_workspace$"], excludes=[]),
        "expected": "trim(name) eq 'exact_workspace'",
    },
    "starts_with": {
        "input": FilterPattern(includes=["^dev.*"], excludes=[]),
        "expected": "startswith(name, 'dev')",
    },
    "ends_with": {
        "input": FilterPattern(includes=[".*prod$"], excludes=[]),
        "expected": "endswith(name, 'prod')",
    },
    "contains": {
        "input": FilterPattern(includes=[".*test.*"], excludes=[]),
        "expected": "contains(name, 'test')",
    },
    "multiple_includes": {
        "input": FilterPattern(includes=["^dev.*", ".*prod$"], excludes=[]),
        "expected": "startswith(name, 'dev') or endswith(name, 'prod')",
    },
    "multiple_excludes": {
        "input": FilterPattern(includes=[], excludes=["^test.*", ".*temp$"]),
        "expected": "not(startswith(name, 'test')) and not(endswith(name, 'temp'))",
    },
    "includes_and_excludes": {
        "input": FilterPattern(includes=["^prod.*"], excludes=[".*temp$"]),
        "expected": "startswith(name, 'prod') and not(endswith(name, 'temp'))",
    },
    "includes_without_regex": {
        "input": FilterPattern(includes=["test"], excludes=[]),
        "expected": "contains(name, 'test')",
    },
    "excludes_withour_regex": {
        "input": FilterPattern(includes=[], excludes=["test"]),
        "expected": "not(contains(name, 'test'))",
    },
    "empty_patterns": {
        "input": FilterPattern(includes=[], excludes=[]),
        "expected": None,
    },
}

# Mock class that inherits from PowerBiApiClient
class MockPowerBiApiClient(PowerBiApiClient):
    def __init__(self):
        pass


@pytest.mark.parametrize("test_name,test_data", test_cases.items())
def test_filter_query(test_name, test_data):
    client = MockPowerBiApiClient()
    result = client.create_filter_query(test_data["input"])
    assert result == test_data["expected"], f"Failed test: {test_name}"
