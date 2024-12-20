"""Run test case result resource load test"""

from pathlib import Path
import csv
import yaml

def run_all_resources(summary_file: str, locust_file: str):
    """Test test case result resource"""
    args = [
            "locust",
            "--headless",
            "-H",
            "http://localhost:8585",
            "--user",
            "10",
            "--spawn-rate",
            "2",
            "-f",
            str(locust_file),
            "--run-time",
            "1m",
            "--only-summary",
            "--csv",
            str(summary_file),
        ]

    run_load_test(args)

class TestAllResources(TestCase):

    def test_all_resources(self):
        directory = Path(__file__).parent
        test_resources_dir = directory.joinpath("test_resources")
        
        locust_file = test_resources_dir.joinpath("all_resources.py")
        summary_file = directory.parent.joinpath("summaries/all_")
        manifest_file = directory.parent.joinpath("manifests/manifest.json")

        run_all_resources(str(summary_file), str(locust_file))

        with open(manifest_file, "r") as f:
            manifest = yaml.safe_load(f)

        with open(str(summary_file)+"_stats.csv", "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                if row.get("name") in manifest:
                    assert row.get("fails") == "0"
                    ninety_ninth_percentile = row.get("99%")
                    if ninety_ninth_percentile:
                        ninety_ninth_percentile = int(ninety_ninth_percentile)
                        assert ninety_ninth_percentile <= 100 # 99% of the requests should be below 100ms
    