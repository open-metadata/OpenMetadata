"""Run test case result resource load test"""

import csv
import os
import sys
from pathlib import Path
from unittest import TestCase, skipIf

import yaml

from ingestion.tests.load.utils import run_load_test


def run_all_resources(summary_file: str, locust_file: str):
    """Test test case result resource"""
    args = [
        "locust",
        "--headless",
        "-H",
        "http://localhost:8585",
        "--user",
        os.getenv("LOCUST_USER", "50"),
        "--spawn-rate",
        "1",
        "-f",
        str(locust_file),
        "--run-time",
        os.getenv("LOCUST_RUNTIME", "1m"),
        "--only-summary",
        "--csv",
        str(summary_file),
    ]

    run_load_test(args)


class TestAllResources(TestCase):
    """Test class to run all resources load test"""

    @skipIf(sys.version_info < (3, 9), "locust is not supported on python 3.8")
    def test_all_resources(self):
        """Test all resources"""
        directory = Path(__file__).parent
        test_resources_dir = directory.joinpath("test_resources")

        locust_file = test_resources_dir.joinpath("all_resources.py")
        summary_file = directory.parent.joinpath("load/summaries/all_")
        manifest_file = test_resources_dir.joinpath("manifest.yaml")

        run_all_resources(str(summary_file), str(locust_file))

        with open(manifest_file, "r", encoding="utf-8") as f:
            manifest = yaml.safe_load(f)

        with open(str(summary_file) + "_stats.csv", "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                name = row.get("Name")
                if name in manifest:
                    resource = manifest.get(name)
                    type_ = resource.get("type")
                    if type_ == row.get("Type"):
                        for metric, threshold in resource.items():
                            with self.subTest(stat=metric, resource=name, type_=type_):
                                stat = row.get(metric)
                                if stat:
                                    stat = int(stat)
                                    self.assertLessEqual(
                                        stat,
                                        threshold,
                                        msg=f"{metric} for {name} is greater than threshold",
                                    )
