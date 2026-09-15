#!/usr/bin/env python3
"""Run five alternating API benchmark pairs against two prepared, isolated servers."""

import argparse
import copy
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from entity_api_acceptance import (
    SIDES,
    evaluate,
    evaluate_capacity,
    reference,
    validate_case,
    verified_path,
)

BENCHMARK = "org.openmetadata.it.perf.EntityApiBenchmark"
CONTROL = "org.openmetadata.it.perf.EntityBenchmarkControlClient"


def digest_json(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def write_json(path, value):
    with path.open("x") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def invoke(command, output, timeout):
    started = time.monotonic()
    wall = time.time()
    with output.with_suffix(output.suffix + ".log").open("x") as stream:
        completed = subprocess.run(
            command,
            stdout=stream,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            check=False,
        )
    elapsed = time.monotonic() - started
    if abs(time.time() - wall - elapsed) > 1:
        raise ValueError("Clock discontinuity invalidated the measurement")
    output.with_suffix(output.suffix + ".exit").write_text(f"{completed.returncode}\n")
    return completed.returncode


def control(server, command, output):
    code = invoke(
        [*server["java"], CONTROL, server["control_path"], command, str(output)],
        output,
        60,
    )
    if code:
        raise ValueError(f"Control {command} failed; inspect {output}.log")
    return output.read_text()


def await_cache(server, output, available):
    deadline = time.monotonic() + 45
    attempt = 0
    while True:
        state = json.loads(
            control(
                server, "cache-state", output.with_name(f"{output.name}-{attempt}.json")
            )
        )
        if not state["configured"]:
            raise ValueError("Redis disappeared from the server configuration")
        if state["available"] == available:
            return
        if time.monotonic() >= deadline:
            raise ValueError("Redis did not reach the required availability state")
        attempt += 1
        time.sleep(1)


def validate_configuration(config, directory):
    validate_case(config["case"])
    if config["kind"] not in ("calibration", "comparison", "capacity"):
        raise ValueError("Expected calibration, capacity or comparison")
    if (
        config["samples"] < 2000
        or config["warmup"] < 1000
        or config["conditioning"] < config["samples"]
    ):
        raise ValueError(
            "Require >=2000 samples, >=1000 warmups and conditioning >=samples"
        )
    for entry in config["client_files"]:
        verified_path(entry, directory)
    if not config["client_files"]:
        raise ValueError("Freeze the version-neutral client before measuring")
    for side in SIDES:
        server = config["servers"][side]
        verified_path(server["artifact"], directory)
        server["manifest_path"] = str(verified_path(server["manifest"], directory))
        server["control_path"] = str(verified_path(server["control"], directory))
        if not server["java"] or has_instrumentation(server["java"]):
            raise ValueError("Use an uninstrumented Java client command")
        manifest = json.loads(Path(server["manifest_path"]).read_text())
        names = [workload["name"] for workload in manifest["workloads"]]
        if names.count(config["case"]["workload"]) != 1:
            raise ValueError("Both fixture manifests must contain the exact workload")
    if (
        config["servers"]["baseline"]["control_path"]
        == config["servers"]["candidate"]["control_path"]
    ):
        raise ValueError("Use two separate server processes")


def has_instrumentation(command):
    arguments = list(command)
    for name in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS"):
        arguments.extend(shlex.split(os.environ.get(name, "")))
    for argument in command:
        if argument.startswith("@"):
            arguments.extend(shlex.split(Path(argument[1:]).read_text(), comments=True))
    prefixes = ("-javaagent:", "-agentlib:", "-agentpath:", "-XX:StartFlightRecording")
    return any(argument.startswith(prefixes) for argument in arguments)


def record_environment(config, output):
    environments = {}
    sessions = set()
    for side in SIDES:
        response = control(
            config["servers"][side], "environment", output / f"{side}-environment.json"
        )
        environment = json.loads(response)
        if environment.get("instrumented", True):
            raise ValueError("Server instrumentation invalidates latency observations")
        sessions.add(environment["containersSession"])
        environments[side] = {
            key: value
            for key, value in environment.items()
            if key != "containersSession"
        }
    if environments["baseline"] != environments["candidate"]:
        raise ValueError(
            "Baseline/candidate Java, OS, architecture or processors differ"
        )
    if len(sessions) != 2:
        raise ValueError("Baseline/candidate must use separate server processes")
    return digest_json(
        {"runtime": environments["baseline"], "configuration": config["runner"]}
    )


def create_plan(config, directory, output):
    validate_configuration(config, directory)
    plan = {
        key: config[key]
        for key in ("kind", "case", "samples", "warmup", "conditioning")
    }
    plan.update(
        baseline_sha256=config["servers"]["baseline"]["artifact"]["sha256"],
        candidate_sha256=config["servers"]["candidate"]["artifact"]["sha256"],
        client_sha256=digest_json(
            [entry["sha256"] for entry in config["client_files"]]
        ),
        runner_sha256=record_environment(config, output),
        instrumented=False,
    )
    if (
        plan["kind"] == "calibration"
        and plan["baseline_sha256"] != plan["candidate_sha256"]
    ):
        raise ValueError("Calibration needs two copies of the same baseline artifact")
    if plan["kind"] in ("comparison", "capacity"):
        path = verified_path(config["calibration"], directory)
        calibration = evaluate(json.loads(path.read_text()), path.parent)
        if calibration["kind"] != "calibration" or calibration["status"] != "passed":
            raise ValueError(
                "A failed/incomplete calibration blocks candidate measurements"
            )
        if any(
            calibration[key] != plan[key]
            for key in ("case", "baseline_sha256", "runner_sha256", "client_sha256")
        ):
            raise ValueError(
                "Calibration must use the same case, baseline, client and runner"
            )
    if config["kind"] == "capacity":
        if config["case"]["phase"] != "latency":
            raise ValueError(
                "Capacity ramps start from a calibrated single-client case"
            )
        if (
            config["case"]["cache"] in ("cold", "l1-cold")
            and config["case"].get("cache_lifecycle") != "cold-start"
        ):
            raise ValueError(
                "Capacity needs a concurrent cold start, not per-request resets"
            )
        rates = config["rates"]
        if (
            len(rates) < 2
            or len(rates) > 16
            or sorted(set(rates)) != rates
            or rates[0] <= 0
        ):
            raise ValueError("Predeclare 2..16 increasing positive capacity rates")
        if not 0 < config["max_submission_delay_ms"] <= 100:
            raise ValueError("Predeclare a capacity queue-delay bound in (0, 100] ms")
        plan.update(
            rates=rates, max_submission_delay_ms=config["max_submission_delay_ms"]
        )
    if config["case"]["phase"] not in ("latency", "allocation"):
        path = verified_path(config["capacity"], directory)
        capacity = evaluate_capacity(json.loads(path.read_text()), path.parent)
        if (
            capacity["status"] != "passed"
            or capacity["baseline_capacity_rps"]
            != config["case"]["baseline_capacity_rps"]
        ):
            raise ValueError(
                "Load phases require a complete, bracketed baseline capacity ramp"
            )
        for key in ("baseline_sha256", "client_sha256", "runner_sha256"):
            if capacity[key] != plan[key]:
                raise ValueError("Capacity and comparison inputs differ")
    write_json(output / "plan.json", plan)
    return plan


def properties(config, server, phase):
    case = config["case"]
    cache = case["cache"]
    reset = (
        cache
        if cache in ("cold", "l1-cold") and case.get("cache_lifecycle") != "cold-start"
        else "none"
    )
    warmup_rate = case.get("baseline_capacity_rps", case["offered_rps"]) * 0.25
    result = [
        f"-DentityBenchmark.control={server['control_path']}",
        f"-DentityBenchmark.scheduling={case['scheduling']}",
        f"-DentityBenchmark.concurrency={case.get('concurrency', 32)}",
        f"-DentityBenchmark.reset={reset}",
        f"-DentityBenchmark.warmupRate={warmup_rate}",
    ]
    if phase != "conditioning" and case.get("cache_lifecycle") == "cold-start":
        result.append(f"-DentityBenchmark.coldStart={cache}")
    if phase != "conditioning" and case["phase"] == "allocation":
        result.append("-DentityBenchmark.allocations=true")
    return result


def measure(config, directory, output, side, phase, round_number=None):
    for entry in config["client_files"]:
        verified_path(entry, directory)
    server = config["servers"][side]
    target = output / f"{side}-{phase}.csv"
    conditioning = phase == "conditioning"
    before_state = record_cache_state(
        config, server, Path(f"{target}.cache-before.json")
    )
    overload = None
    if not conditioning and config["case"]["phase"] == "recovery":
        prelude = copy.deepcopy(config)
        prelude["case"].update(
            phase="overload", offered_rps=config["case"]["baseline_capacity_rps"] * 1.25
        )
        overload = measure(
            prelude, directory, output, side, phase + "-overload", round_number
        )
    samples = config["conditioning"] if conditioning else config["samples"]
    warmup = 0 if conditioning else config["warmup"]
    rate = config["case"]["offered_rps"]
    if conditioning:
        rate = config["case"].get("baseline_capacity_rps", rate) * 0.25
    command = [
        *server["java"],
        *properties(config, server, phase),
        BENCHMARK,
        server["manifest_path"],
        str(target),
        str(samples),
        str(warmup),
        str(rate),
        re.escape(config["case"]["workload"]),
    ]
    code = invoke(command, target, config.get("timeout_seconds", 7200))
    expected_overload_failure = (
        code == 1
        and not conditioning
        and config["case"]["phase"] in ("overload", "capacity")
        and target.exists()
    )
    if code and not expected_overload_failure:
        raise ValueError(f"Benchmark failed; inspect {target}.log")
    after_state = record_cache_state(config, server, Path(f"{target}.cache-after.json"))
    event = {
        "at": datetime.now(timezone.utc).isoformat(),
        "side": side,
        "phase": phase,
        "exit": code,
    }
    with (output / "events.jsonl").open("a") as stream:
        stream.write(json.dumps(event) + "\n")
    print(f"{side}: {phase} completed", flush=True)
    if conditioning:
        return None
    row = {
        "round": round_number,
        "side": side,
        "summary": reference(target),
        "requests": reference(
            Path(f"{target}.{config['case']['workload']}.requests.csv")
        ),
        "exit": reference(Path(f"{target}.exit")),
        "cache_states": [before_state, after_state],
    }
    if config["case"]["phase"] == "allocation":
        row["allocation"] = reference(
            Path(f"{target}.{config['case']['workload']}.allocation.json")
        )
    if overload is not None:
        row["overload"] = overload
    if config["case"].get("cache_lifecycle") == "cold-start":
        row["cache_reset"] = reference(
            Path(f"{target}.{config['case']['workload']}.cache.json")
        )
    return row


def record_cache_state(config, server, output):
    state = json.loads(control(server, "cache-state", output))
    cache = config["case"]["cache"]
    if state["configured"] != (cache != "disabled") or (
        state["configured"] and state["available"] != (cache != "unavailable")
    ):
        raise ValueError(
            "Observed cache availability differs from the declared workload"
        )
    return reference(output)


def prepare_cache(config, output, paused):
    for side in SIDES:
        server = config["servers"][side]
        cache = config["case"]["cache"]
        state = json.loads(
            control(server, "cache-state", output / f"{side}-cache-before.json")
        )
        if state["configured"] != (cache != "disabled"):
            raise ValueError("Server cache provider differs from the declared case")
        if cache == "unavailable":
            paused.add(side)
            control(server, "redis-pause", output / f"{side}-redis-pause.json")
            await_cache(server, output / f"{side}-unavailable", False)
        elif cache == "recovered":
            paused.add(side)
            control(server, "redis-pause", output / f"{side}-redis-pause.json")
            await_cache(server, output / f"{side}-unavailable", False)
            control(server, "redis-resume", output / f"{side}-redis-resume.json")
            paused.remove(side)
            await_cache(server, output / f"{side}-recovered", True)
        elif cache != "disabled":
            await_cache(server, output / f"{side}-available", True)


def run(config_file, output):
    config_file = config_file.resolve()
    config = json.loads(config_file.read_text())
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    write_json(
        output / "inputs.json",
        {
            "config": reference(config_file),
            "client_files": config["client_files"],
            "servers": config["servers"],
        },
    )
    plan = create_plan(config, config_file.parent, output)
    manifest = {"plan": reference(output / "plan.json"), "runs": []}
    if config["kind"] in ("comparison", "capacity"):
        manifest["calibration"] = reference(
            verified_path(config["calibration"], config_file.parent)
        )
    if config["case"]["phase"] not in ("latency", "allocation"):
        manifest["capacity"] = reference(
            verified_path(config["capacity"], config_file.parent)
        )
    paused = set()
    try:
        prepare_cache(config, output, paused)
        for side in ("baseline",) if config["kind"] == "capacity" else SIDES:
            measure(config, config_file.parent, output, side, "conditioning")
        for round_number in range(1, 6):
            if config["kind"] == "capacity":
                for index, rate in enumerate(config["rates"]):
                    probe = copy.deepcopy(config)
                    probe["case"].update(
                        phase="capacity",
                        scheduling="open-loop",
                        offered_rps=rate,
                        baseline_capacity_rps=config["rates"][0],
                    )
                    row = measure(
                        probe,
                        config_file.parent,
                        output,
                        "baseline",
                        f"round-{round_number}-rate-{index}",
                        round_number,
                    )
                    row["offered_rps"] = rate
                    manifest["runs"].append(row)
                continue
            for side in SIDES if round_number % 2 else SIDES[::-1]:
                manifest["runs"].append(
                    measure(
                        config,
                        config_file.parent,
                        output,
                        side,
                        f"round-{round_number}",
                        round_number,
                    )
                )
    finally:
        cleanup_errors = []
        for side in sorted(paused):
            try:
                control(
                    config["servers"][side],
                    "redis-resume",
                    output / f"{side}-cleanup-redis-resume.json",
                )
            except (OSError, ValueError, subprocess.TimeoutExpired) as error:
                cleanup_errors.append(error)
        if cleanup_errors:
            raise ValueError(
                "Could not resume every paused Redis container; see retained control logs"
            ) from cleanup_errors[0]
    if config["kind"] == "capacity":
        manifest["kind"] = "capacity"
    write_json(output / "measurements.json", manifest)
    result = (
        evaluate_capacity(manifest, output)
        if config["kind"] == "capacity"
        else evaluate(manifest, output)
    )
    result["kind"] = plan["kind"]
    write_json(output / "result.json", result)
    return 0 if result["status"] == "passed" else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        return run(args.config, args.output.resolve())
    except (
        OSError,
        ValueError,
        KeyError,
        TypeError,
        subprocess.TimeoutExpired,
    ) as error:
        print(f"Benchmark rejected: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
