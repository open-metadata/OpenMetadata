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

"""Select CI workloads from the event and its changed-path filters."""

import argparse
import json
import os
from pathlib import Path


def select(
    entrypoint: str, event: str, payload: dict, matched: set[str]
) -> dict[str, bool]:
    """Return the jobs selected for a PR, merge group, push, or dispatch."""
    manual = (
        payload.get("inputs", {}).get("workload", "python")
        if event == "workflow_dispatch"
        else None
    )
    queue = entrypoint == "merge-queue"
    draft = event == "pull_request" and payload["pull_request"]["draft"]
    java_unit = not draft and (manual == "java" or "java-unit" in matched)
    python = not draft and (
        manual == "python"
        or (event == "pull_request" and "python" in matched)
        or (event == "merge_group" and bool({"python", "python-backend"} & matched))
    )
    airflow = manual == "python" or (
        not draft
        and event in {"pull_request", "merge_group"}
        and "airflow-apis" in matched
    )
    java_it = queue and (manual == "java" or "java-integration" in matched)
    rdf = queue and "rdf" in matched

    return {
        "checkstyle": java_unit or (not draft and "java-checkstyle" in matched),
        "java-unit": java_unit,
        "java-operator": not draft and (manual == "java" or "java-operator" in matched),
        "docker-smoke": not draft and (manual == "java" or "docker-smoke" in matched),
        "java-it": java_it or rdf,
        "java-it-redis": java_it,
        "python": python,
        "airflow-apis": airflow,
        "static": python
        or airflow
        or (not draft and event != "push" and "python-static" in matched),
        "json-yaml": event == "merge_group"
        or (
            event == "pull_request"
            and payload["action"] != "ready_for_review"
            and "json-yaml" in matched
        ),
        "quickstart-compose": not queue
        and (
            manual == "quickstart-compose"
            or (
                event == "pull_request"
                and payload["action"] != "ready_for_review"
                and "quickstart-compose" in matched
            )
        ),
        "dar": queue and event in {"merge_group", "push"} and "dar" in matched,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("entrypoint", choices=("pr", "merge-queue"))
    args = parser.parse_args()
    event = os.environ["GITHUB_EVENT_NAME"]
    payload = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    matched = set()
    if event != "workflow_dispatch":
        changes = json.loads(os.environ["MATCHED_FILTERS"])
        if not isinstance(changes, list) or any(
            not isinstance(name, str) for name in changes
        ):
            parser.error("expected a list of matched path filters")
        matched = set(changes)
    selected = select(args.entrypoint, event, payload, matched)
    with Path(os.environ["GITHUB_OUTPUT"]).open("a") as output:
        for name, enabled in selected.items():
            output.write(f"{name}={json.dumps(enabled)}\n")


if __name__ == "__main__":
    main()
