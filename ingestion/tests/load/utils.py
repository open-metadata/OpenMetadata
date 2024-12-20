"""Utils functions for load testing."""

import sys
from typing import List

import pytest
from locust import main

TEST_CASE_RESOURCE_PATH = "/api/v1/dataQuality/testCases"
TEST_CASE_RESULT_RESOURCE_PATH = "/api/v1/dataQuality/testCases/testCaseResults"


def run_load_test(args: List[str]):
    """Test test case result resource"""
    original_argv = sys.argv
    try:
        sys.argv = args
        with pytest.raises(SystemExit) as excinfo:
            main.main()
        assert excinfo.value.code == 0
    finally:
        sys.argv = original_argv
