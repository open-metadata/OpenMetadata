#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Stream a Nox suite to its CI log and preserve the process exit status."""

import argparse
import shlex
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("suite", choices=("unit", "integration"))
    parser.add_argument("--nox-args", default="")
    args = parser.parse_args()
    command = ["nox", "--no-venv", "-s", f"{args.suite}-tests"]
    if args.suite == "integration":
        command.extend(["--", "--standalone", "--durations=5"])
    command.extend(shlex.split(args.nox_args))
    with (
        Path(f"{args.suite}-test-run.log").open("w") as log,
        subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True) as process,
    ):
        for line in process.stdout:
            log.write(line)
            sys.stdout.write(line)
            sys.stdout.flush()
        code = process.wait()
    code = code if code >= 0 else 128 - code
    Path(f"{args.suite}-test-exit-code.txt").write_text(f"{code}\n")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
