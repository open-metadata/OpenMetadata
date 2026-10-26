#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Verify installed artifacts without importing the source checkout."""

import argparse
import importlib
import importlib.metadata
import importlib.resources
import json
import sys
from pathlib import Path

from packaging.markers import default_environment
from packaging.requirements import Requirement
from packaging.utils import canonicalize_name


def check_metadata(policy):
    """Check installed requirements, including active image extras and narrow exceptions."""
    installed = {canonicalize_name(item.metadata["Name"]): item for item in importlib.metadata.distributions()}
    environment = default_environment()
    extras = {"openmetadata-ingestion": set(policy.get("extras", []))}
    roots = policy.get("roots", [])
    errors = []
    while True:
        changed = False
        errors = []
        requirements = [("image", value) for value in roots]
        for name, distribution in installed.items():
            requirements.extend((name, value) for value in distribution.requires or [])
        for owner, value in requirements:
            requirement = Requirement(value)
            if requirement.marker and not any(
                requirement.marker.evaluate({**environment, "extra": extra})
                for extra in extras.get(owner, set()) | {""}
            ):
                continue
            name = canonicalize_name(requirement.name)
            if owner == "pydoris" and name == "mysqlclient" and policy.get("kind") == "operator":
                if installed[owner].version != "1.2.0" or str(requirement.specifier) != "<3,>=2.1.0":
                    errors.append("pydoris metadata exception drifted")
                    continue
                requirement = Requirement("pymysql~=1.0")
                name = "pymysql"
            if owner == "sqlalchemy-ibmi" and name == "sqlalchemy":
                if installed[owner].version != "0.9.3" or str(requirement.specifier) != "<2.0,>=1.3.0":
                    errors.append("sqlalchemy-ibmi metadata exception drifted")
                    continue
                requirement = Requirement("sqlalchemy>=2.0,<2.1")
            if name == "psycopg2-binary" and policy.get("source-psycopg2"):
                name = "psycopg2"
                if (
                    "psycopg2-binary" in installed
                    or installed.get(name) is None
                    or installed[name].version != policy["source-psycopg2"]
                ):
                    errors.append("Image PostgreSQL driver replacement drifted")
                    continue
            if name not in installed or not requirement.specifier.contains(installed[name].version, prereleases=True):
                errors.append(
                    f"{owner} requires {requirement}; installed {installed[name].version if name in installed else 'missing'}"
                )
                continue
            selected = extras.setdefault(name, set())
            new = requirement.extras - selected
            selected.update(new)
            changed = changed or bool(new)
        if not changed:
            break
    if policy.get("kind") == "operator" and "mysqlclient" in installed:
        errors.append("Operator image contains unused mysqlclient")
    if errors:
        raise ValueError("\n".join(sorted(set(errors))))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True)
    parser.add_argument("--managed-api", action="store_true")
    parser.add_argument("--policy", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    distributions = ["openmetadata-ingestion"] + (["openmetadata-managed-apis"] if args.managed_api else [])
    for name in distributions:
        if importlib.metadata.version(name) != args.version:
            raise ValueError(f"Unexpected artifact version: {name}")
    for distribution in importlib.metadata.distributions():
        direct = distribution.read_text("direct_url.json")
        if direct and json.loads(direct).get("dir_info") is not None:
            raise ValueError(f"Source/editable dependency in artifact environment: {distribution.metadata['Name']}")
        if any(Requirement(value).url for value in distribution.requires or []):
            raise ValueError(f"Direct dependency URL in published metadata: {distribution.metadata['Name']}")
    modules = [
        "metadata.generated.schema.entity.data.table",
        "metadata.generated.antlr.FqnLexer",
        "metadata.ingestion.ometa.ometa_api",
    ]
    if args.managed_api:
        modules.append("openmetadata_managed_apis.plugin")
        if not importlib.resources.files("openmetadata_managed_apis").joinpath("resources/dag_runner.j2").is_file():
            raise ValueError("Missing managed API template")
    imports = {}
    for name in modules:
        module = importlib.import_module(name)
        path = Path(module.__file__).resolve()
        if not path.is_relative_to(Path(sys.prefix).resolve()):
            raise ValueError(f"Import escaped installed environment: {name}: {path}")
        imports[name] = str(path)
    if not importlib.resources.files("metadata.examples").joinpath("workflows/airflow.yaml").is_file():
        raise ValueError("Missing packaged workflow resources")
    if args.policy:
        check_metadata(json.loads(args.policy.read_text()))
    result = {"python": sys.version, "prefix": sys.prefix, "version": args.version, "imports": imports}
    if args.output:
        args.output.write_text(json.dumps(result, indent=2) + "\n")
    sys.stdout.write(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
