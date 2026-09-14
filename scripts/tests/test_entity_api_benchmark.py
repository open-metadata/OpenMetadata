import importlib.util
import json
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location(
    "entity_api_benchmark", SCRIPTS / "entity_api_benchmark.py"
)
benchmark = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(benchmark)

CLIENT_FIXTURE = """
import csv, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
args = sys.argv[2:]
if "org.openmetadata.it.perf.EntityBenchmarkControlClient" in args:
    _, command, output = args[-3:]
    state = root / "paused"
    if command == "environment":
        value = {"javaRuntime": "fixture-21", "javaVendor": "fixture", "os": "fixture", "architecture": "fixture", "processors": 4, "containersSession": str(root), "instrumented": False}
    elif command == "cache-state":
        value = {"configured": True, "available": not state.exists()}
    elif command == "redis-pause":
        state.touch()
        value = "ok"
    elif command == "redis-resume":
        state.unlink(missing_ok=True)
        value = "ok"
    pathlib.Path(output).write_text(json.dumps(value) if isinstance(value, dict) else value)
else:
    manifest, output, samples, warmup, rate, expression = args[-6:]
    samples = int(samples)
    workload = json.loads(pathlib.Path(manifest).read_text())["workloads"][0]["name"]
    props = dict(arg[2:].split("=", 1) for arg in args if arg.startswith("-D"))
    scheduling = props["entityBenchmark.scheduling"]
    latency = float((root / "latency").read_text())
    with open(output, "w", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["workload", "samples", "errors", "p50_ms", "p95_ms", "p99_ms", "mean_ms", "offered_rps", "elapsed_seconds", "reset", "max_in_flight", "scheduling"])
        elapsed = samples * latency / 1000 if scheduling == "single-client" else max(samples * latency / 1000, samples / float(rate))
        writer.writerow([workload, samples, 0, latency, latency, latency, latency, 0 if scheduling == "single-client" else rate, elapsed, "none", 1 if scheduling == "single-client" else 32, scheduling])
    with open(output + "." + workload + ".requests.csv", "w", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["sequence", "latency_ms", "submission_delay_ms", "http_status", "success"])
        writer.writerows([index + 1, latency, 0, 200, "true"] for index in range(samples))
"""


def configuration(tmp_path):
    client = tmp_path / "client.py"
    client.write_text(CLIENT_FIXTURE)
    artifact = tmp_path / "artifact.jar"
    artifact.write_bytes(b"test fixture, not release evidence")
    servers = {}
    for side in ("baseline", "candidate"):
        root = tmp_path / side
        root.mkdir()
        (root / "latency").write_text("1")
        manifest = root / "manifest.json"
        manifest.write_text(json.dumps({"workloads": [{"name": "get.columns.100"}]}))
        endpoint = root / "control.json"
        endpoint.write_text("{}")
        servers[side] = {
            "java": [sys.executable, str(client), str(root)],
            "artifact": benchmark.reference(artifact),
            "manifest": benchmark.reference(manifest),
            "control": benchmark.reference(endpoint),
        }
    return {
        "kind": "calibration",
        "samples": 2000,
        "warmup": 1000,
        "conditioning": 2000,
        "case": {
            "database": "mysql",
            "cache": "warm",
            "workload": "get.columns.100",
            "phase": "latency",
            "scheduling": "single-client",
            "offered_rps": 1000,
        },
        "runner": {"purpose": "protocol test fixture; not performance acceptance"},
        "client_files": [benchmark.reference(client)],
        "servers": servers,
    }


def execute(tmp_path, config, name):
    path = tmp_path / (name + ".json")
    path.write_text(json.dumps(config))
    output = tmp_path / name
    return benchmark.run(path, output), output


def test_runner_retains_five_alternating_pairs_and_blocks_a_regression(tmp_path):
    config = configuration(tmp_path)
    code, calibration = execute(tmp_path, config, "calibration")
    assert code == 0
    events = [
        json.loads(line)
        for line in (calibration / "events.jsonl").read_text().splitlines()
    ]
    assert [event["side"] for event in events[2:]] == [
        "baseline",
        "candidate",
        "candidate",
        "baseline",
        "baseline",
        "candidate",
        "candidate",
        "baseline",
        "baseline",
        "candidate",
    ]
    config["kind"] = "comparison"
    config["calibration"] = benchmark.reference(calibration / "measurements.json")
    (tmp_path / "candidate/latency").write_text("1.01")
    code, output = execute(tmp_path, config, "comparison")
    assert code == 1
    assert json.loads((output / "result.json").read_text())["status"] == "regression"


def test_failed_calibration_prevents_dependent_load_generation(tmp_path):
    config = configuration(tmp_path)
    (tmp_path / "candidate/latency").write_text("1.5")
    code, calibration = execute(tmp_path, config, "unstable")
    assert code == 1
    config["kind"] = "comparison"
    config["calibration"] = benchmark.reference(calibration / "measurements.json")
    with pytest.raises(ValueError, match="calibration blocks"):
        execute(tmp_path, config, "blocked")
    assert not list((tmp_path / "blocked").glob("*.csv"))


def test_recovery_observes_both_cache_states(tmp_path):
    config = configuration(tmp_path)
    config["case"]["cache"] = "recovered"
    code, output = execute(tmp_path, config, "cache-recovery")
    assert code == 0
    for side in ("baseline", "candidate"):
        assert not json.loads((output / f"{side}-unavailable-0.json").read_text())[
            "available"
        ]
        assert json.loads((output / f"{side}-recovered-0.json").read_text())[
            "available"
        ]
        assert not (tmp_path / side / "paused").exists()


def test_capacity_is_bracketed_and_recovery_contains_an_overload_for_every_pair(
    tmp_path,
):
    config = configuration(tmp_path)
    code, calibration = execute(tmp_path, config, "calibration")
    assert code == 0
    config.update(
        kind="capacity",
        calibration=benchmark.reference(calibration / "measurements.json"),
        rates=[500, 1000, 2000],
        max_submission_delay_ms=5,
    )
    code, capacity = execute(tmp_path, config, "capacity")
    assert code == 0
    assert (
        json.loads((capacity / "result.json").read_text())["baseline_capacity_rps"]
        == 1000
    )
    config.update(
        kind="calibration", capacity=benchmark.reference(capacity / "measurements.json")
    )
    config["case"].update(
        phase="recovery",
        scheduling="open-loop",
        baseline_capacity_rps=1000,
        offered_rps=500,
    )
    code, recovery = execute(tmp_path, config, "overload-recovery")
    assert code == 0
    runs = json.loads((recovery / "measurements.json").read_text())["runs"]
    assert len(runs) == 10
    assert all(
        run["overload"]["side"] == run["side"]
        and run["overload"]["round"] == run["round"]
        for run in runs
    )


def test_a_capacity_ramp_without_saturation_is_inconclusive(tmp_path):
    config = configuration(tmp_path)
    code, calibration = execute(tmp_path, config, "calibration")
    assert code == 0
    config.update(
        kind="capacity",
        calibration=benchmark.reference(calibration / "measurements.json"),
        rates=[500, 1000],
        max_submission_delay_ms=5,
    )
    code, capacity = execute(tmp_path, config, "capacity")
    assert code == 1
    assert (
        json.loads((capacity / "result.json").read_text())["status"] == "inconclusive"
    )


def test_instrumentation_in_argument_files_and_environment_is_rejected(
    tmp_path, monkeypatch
):
    for key in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS"):
        monkeypatch.delenv(key, raising=False)
    assert not benchmark.has_instrumentation(["java", "-cp", "/build/agent-client.jar"])
    arguments = tmp_path / "client.args"
    arguments.write_text("-Xmx1g\n-javaagent:coverage.jar\n")
    assert benchmark.has_instrumentation(["java", "@" + str(arguments)])
    monkeypatch.setenv("JAVA_TOOL_OPTIONS", "-agentpath:profiler.so")
    assert benchmark.has_instrumentation(["java"])
