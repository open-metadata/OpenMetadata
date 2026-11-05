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

from pathlib import Path

ACTION = (
    Path(__file__).resolve().parents[2] / ".github/actions/setup-openmetadata-test-environment/action.yml"
).read_text(encoding="utf-8")


def step(name: str) -> str:
    start = ACTION.index(f"    - name: {name}")
    end = ACTION.find("\n    - name:", start + 1)
    return ACTION[start:] if end == -1 else ACTION[start:end]


def test_full_dependency_install_repairs_and_validates_airflow() -> None:
    install_step = step("Install Python Dependencies")

    assert "from airflow.models import Connection" in install_step
    assert "--no-cache" in install_step
    assert "--reinstall-package apache-airflow-core" in install_step
    assert install_step.index("ingestion[test]") < install_step.index("from airflow.models import Connection")


if __name__ == "__main__":
    test_full_dependency_install_repairs_and_validates_airflow()
