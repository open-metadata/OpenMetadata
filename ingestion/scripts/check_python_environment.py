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

"""Validate installed profile requirements and exact dependency metadata exceptions."""

import argparse
import importlib.metadata
import json
import sys
from pathlib import Path

from packaging.markers import default_environment
from packaging.requirements import Requirement
from packaging.specifiers import SpecifierSet
from packaging.utils import canonicalize_name

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib


def group_requirements(groups, name, parents=()):
    """Expand dependency-group includes, rejecting cycles."""
    if name in parents:
        raise ValueError(f"Dependency-group cycle: {' -> '.join((*parents, name))}")
    result = []
    for entry in groups[name]:
        if isinstance(entry, str):
            result.append(entry)
        else:
            result.extend(group_requirements(groups, entry["include-group"], (*parents, name)))
    return result


def metadata_exceptions(data, policy, installed):
    """Validate exact upstream metadata before applying a dependency exception."""
    errors = []
    exceptions = {}
    for exception in policy.get("metadata-exceptions", []):
        name = canonicalize_name(exception["package"])
        if name not in installed:
            continue
        distribution = installed[name]
        declared = [Requirement(r) for r in distribution.requires or []]
        dependency = canonicalize_name(exception["dependency"])
        matches = [r for r in declared if canonicalize_name(r.name) == dependency]
        if (
            distribution.version != exception["version"]
            or len(matches) != 1
            or matches[0].specifier != SpecifierSet(exception["declared"])
            or matches[0].marker is not None
        ):
            errors.append(f"Metadata exception drifted: {name}=={exception['version']}")
            continue
        replacement = Requirement(f"{dependency}{exception['accepted']}")
        effective = {str(r) for r in declared if r is not matches[0]} | {str(replacement)}
        metadata = [
            m
            for m in data["tool"]["uv"].get("dependency-metadata", [])
            if canonicalize_name(m["name"]) == name and m.get("version") == exception["version"]
        ]
        if len(metadata) != 1 or {str(Requirement(r)) for r in metadata[0]["requires-dist"]} != effective:
            errors.append(f"Metadata exception changes unrelated requirements: {name}")
            continue
        exceptions[name, dependency] = replacement

    return exceptions, errors


def check_environment(project, profile_name, distributions=None):
    """Return profile and installed-metadata violations."""
    data = tomllib.loads((project / "pyproject.toml").read_text())
    policy = data["tool"]["openmetadata"]["python-environments"]
    profile = policy["profiles"][profile_name]
    installed = {
        canonicalize_name(d.metadata["Name"]): d
        for d in (importlib.metadata.distributions() if distributions is None else distributions)
    }
    exceptions, errors = metadata_exceptions(data, policy, installed)
    roots = []
    for name in profile["groups"]:
        roots.extend(group_requirements(data["dependency-groups"], name))
    project_name = canonicalize_name(data["project"]["name"])
    extras = {project_name: set(profile["extras"])}
    if profile["install-project"]:
        roots.append(project_name)
    errors.extend(
        f"Remove conflicting distribution: {name}"
        for name in policy.get("forbidden-packages", [])
        if canonicalize_name(name) in installed
    )

    environment = default_environment()
    while True:
        changed = False
        requirements = [("profile", r) for r in roots]
        for name, distribution in installed.items():
            requirements.extend((name, r) for r in distribution.requires or [])
        current_errors = []
        for owner, raw in requirements:
            requirement = Requirement(raw)
            if requirement.marker and not any(
                requirement.marker.evaluate({**environment, "extra": extra})
                for extra in extras.get(owner, set()) | {""}
            ):
                continue
            name = canonicalize_name(requirement.name)
            effective = exceptions.get((owner, name), requirement)
            if name not in installed:
                current_errors.append(f"{owner} requires {effective}; package is missing")
                continue
            if not effective.specifier.contains(installed[name].version, prereleases=True):
                current_errors.append(f"{owner} requires {effective}; installed {installed[name].version}")
            selected = extras.setdefault(name, set())
            new = requirement.extras - selected
            if new:
                selected.update(new)
                changed = True
        if not changed:
            errors.extend(current_errors)
            break
    return sorted(set(errors))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument(
        "--profile", required=True, choices=["runtime", "all", "api", "style", "generation", "dev", "test", "coverage"]
    )
    parser.add_argument(
        "--check-models", action="store_true", help="Also verify the release-pinned classification data."
    )
    args = parser.parse_args()
    errors = check_environment(args.project, args.profile)
    if args.check_models:
        errors.extend(check_classification_models(args.project))
    for error in errors:
        sys.stderr.write(error + "\n")
    if not errors:
        sys.stdout.write(f"Python profile {args.profile}: installed requirements are consistent\n")
    return bool(errors)


def check_classification_models(project, distributions=None):
    """Validate each configured language model against the release registry."""
    from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage
    from metadata.pii.model_registry import resolve_model_specifications

    data = tomllib.loads((project / "pyproject.toml").read_text())
    languages = data["tool"]["openmetadata"]["python-environments"]["classification-models"]["languages"]
    installed = {
        canonicalize_name(d.metadata["Name"]): d
        for d in (importlib.metadata.distributions() if distributions is None else distributions)
    }
    if "spacy" not in installed:
        return ["Missing classification runtime: spacy"]
    errors = []
    for specification in resolve_model_specifications([ClassificationLanguage(language) for language in languages]):
        distribution = installed.get(canonicalize_name(specification.name))
        if distribution is None:
            errors.append(f"Missing classification model: {specification.name}=={specification.version}")
        else:
            errors.extend(check_model(distribution, specification, installed["spacy"].version))
    return errors


def check_model(distribution, specification, spacy_version):
    """Validate model data independently of optional wheel dependency metadata."""
    name = specification.name
    path = Path(distribution.locate_file(f"{name}/meta.json"))
    try:
        metadata = json.loads(path.read_text())
    except (OSError, ValueError) as exc:
        return [f"Cannot read classification model {name}: {exc}"]
    if distribution.version != specification.version or metadata.get("version") != specification.version:
        return [f"Classification model version drifted: {name}; expected {specification.version}"]
    supported = SpecifierSet(specification.spacy_version) & SpecifierSet(metadata["spacy_version"])
    if spacy_version not in supported:
        return [f"Classification model {name} requires spaCy {supported}; installed {spacy_version}"]
    return []


if __name__ == "__main__":
    raise SystemExit(main())
