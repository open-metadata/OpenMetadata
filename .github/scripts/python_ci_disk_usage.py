"""Sample runner filesystem headroom and publish its observed range."""

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from contextlib import suppress
from pathlib import Path


def monitor(state):
    paths = {Path("/"), Path(os.environ["GITHUB_WORKSPACE"])}
    if Path("/mnt").exists():
        paths.add(Path("/mnt"))
    readings = {}
    while True:
        for path in sorted(paths):
            free = shutil.disk_usage(path).free
            reading = readings.setdefault(str(path), {"initial": free, "minimum": free, "maximum": free, "growth": 0})
            reading["minimum"] = min(reading["minimum"], free)
            reading["maximum"] = max(reading["maximum"], free)
            reading["growth"] = max(reading["growth"], reading["maximum"] - free)
        pending = state.with_suffix(".tmp")
        pending.write_text(json.dumps(readings))
        pending.replace(state)
        time.sleep(15)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("start", "monitor", "report"))
    args = parser.parse_args()
    state = Path(os.environ["RUNNER_TEMP"]) / "python-ci-disk-usage.json"
    pid = state.with_suffix(".pid")
    if args.command == "start":
        process = subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), "monitor"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        pid.write_text(str(process.pid))
    elif args.command == "monitor":
        monitor(state)
    else:
        if pid.exists():
            with suppress(ProcessLookupError):
                os.kill(int(pid.read_text()), signal.SIGTERM)
            pid.unlink()
        if not state.exists():
            return
        rows = [
            "### Sampled disk headroom",
            "",
            "| Filesystem path | Initial free GiB | Minimum free GiB | Maximum free GiB | Maximum space growth GiB |",
            "| --- | ---: | ---: | ---: | ---: |",
        ]
        for path, reading in json.loads(state.read_text()).items():
            values = [f"{reading[key] / 1024**3:.2f}" for key in ("initial", "minimum", "maximum", "growth")]
            rows.append(f"| {path} | {' | '.join(values)} |")
        rows.extend(["", "Samples are 15 seconds apart; short-lived peaks may be missed.", ""])
        summary = "\n".join(rows)
        sys.stdout.write(summary)
        with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as output:
            output.write(summary)


if __name__ == "__main__":
    main()
