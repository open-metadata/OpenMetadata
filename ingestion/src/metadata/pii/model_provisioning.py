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
"""Install and verify the spaCy models used by auto classification."""

import json
import shlex
import subprocess
import sys
import tempfile
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError, distribution, version
from pathlib import Path

from packaging.requirements import InvalidRequirement, Requirement
from packaging.specifiers import SpecifierSet
from packaging.utils import canonicalize_name
from packaging.version import InvalidVersion, Version

from metadata.pii.model_registry import ModelSpecification

INGESTION_PACKAGE_NAME = "openmetadata-ingestion"
PII_PROCESSOR_EXTRA = "pii-processor"


@dataclass(frozen=True)
class ProvisioningResult:
    """Models completed by one provisioning invocation."""

    completed: list[ModelSpecification]
    installed: list[ModelSpecification]


class ModelProvisioningError(RuntimeError):
    """Provisioning stopped at a specific model and retained prior work."""

    def __init__(
        self,
        specification: ModelSpecification,
        cause: Exception | str,
        completed: list[ModelSpecification],
        unattempted: list[ModelSpecification],
        languages: Sequence[str],
        repair: bool = False,
    ):
        action = (
            _repair_action(specification, languages) if repair else "Fix the reported issue, then rerun the command."
        )
        cause_message = str(cause).rstrip(".")
        super().__init__(
            f"Could not provision {specification.name} {specification.version} for language(s) "
            f"{', '.join(languages) or 'unknown'}: {cause_message}. {action} "
            f"Completed: {_model_names(completed) or 'none'}. "
            f"Unattempted: {_model_names(unattempted) or 'none'}."
        )
        self.completed = completed
        self.failed = specification
        self.unattempted = unattempted


def provision_classification_models(
    specifications: Sequence[ModelSpecification],
    model_languages: Mapping[str, Sequence[str]] | None = None,
    progress: Callable[[str], None] | None = None,
) -> ProvisioningResult:
    """Reconcile configured models with their release-pinned artifacts."""
    if not specifications:
        raise ValueError("At least one model specification is required")

    spacy_version = _verify_pii_dependencies()
    _verify_spacy_compatibility(spacy_version, specifications)

    completed: list[ModelSpecification] = []
    installed: list[ModelSpecification] = []
    for index, specification in enumerate(specifications):
        current_version = _installed_model_version(specification.name)
        languages = (model_languages or {}).get(specification.name, [])
        try:
            if current_version == specification.version:
                try:
                    _verify_model_load(specification)
                except Exception as exc:
                    raise ModelProvisioningError(
                        specification,
                        exc,
                        completed,
                        list(specifications[index + 1 :]),
                        languages,
                        repair=True,
                    ) from exc
                _report(
                    progress,
                    f"Reusing {specification.name} {specification.version}{_language_note(languages)}",
                )
            else:
                if current_version:
                    _report(
                        progress,
                        f"Reconciling {specification.name}{_language_note(languages)} from "
                        f"{current_version} to {specification.version}",
                    )
                else:
                    _report(
                        progress,
                        f"Installing {specification.name} {specification.version}{_language_note(languages)}",
                    )
                _install_model(specification, spacy_version)
                _verify_installed_model_version(specification)
                _verify_model_load(specification)
                installed.append(specification)
                _report(progress, f"Verified {specification.name} {specification.version}{_language_note(languages)}")
        except ModelProvisioningError:
            raise
        except Exception as exc:
            raise ModelProvisioningError(
                specification,
                exc,
                completed,
                list(specifications[index + 1 :]),
                languages,
            ) from exc
        completed.append(specification)

    return ProvisioningResult(completed=completed, installed=installed)


def _verify_pii_dependencies() -> str:
    missing_dependencies: list[str] = []
    try:
        spacy_version = version("spacy")
    except PackageNotFoundError:
        missing_dependencies.append("spaCy")
        spacy_version = ""
    try:
        version("presidio-analyzer")
    except PackageNotFoundError:
        missing_dependencies.append("Presidio Analyzer")
    if missing_dependencies:
        raise MissingPIIProcessorDependencyError(
            f"Missing {', '.join(missing_dependencies)}. Install OpenMetadata with the pii-processor extra."
        )
    return spacy_version


class MissingPIIProcessorDependencyError(RuntimeError):
    """The installation does not include the PII dependencies required by this command."""


def _verify_spacy_compatibility(installed_spacy_version: str, specifications: Sequence[ModelSpecification]) -> None:
    try:
        parsed_version = Version(installed_spacy_version)
    except InvalidVersion as exc:
        raise RuntimeError(f"Installed spaCy version '{installed_spacy_version}' is invalid") from exc

    ingestion_spacy_version = _ingestion_spacy_version_specifier()
    if parsed_version not in ingestion_spacy_version:
        raise RuntimeError(
            f"spaCy {installed_spacy_version} is outside OpenMetadata's supported range {ingestion_spacy_version}"
        )
    for specification in specifications:
        if parsed_version not in SpecifierSet(specification.spacy_version):
            raise RuntimeError(
                f"spaCy {installed_spacy_version} is incompatible with {specification.name} "
                f"{specification.version}; expected {specification.spacy_version}"
            )


def _ingestion_spacy_version_specifier() -> SpecifierSet:
    try:
        requirements = distribution(INGESTION_PACKAGE_NAME).requires or []
    except PackageNotFoundError as exc:
        raise RuntimeError(f"Could not read requirements for {INGESTION_PACKAGE_NAME}") from exc

    spacy_specifiers: list[str] = []
    for raw_requirement in requirements:
        try:
            requirement = Requirement(raw_requirement)
        except InvalidRequirement as exc:
            raise RuntimeError(
                f"{INGESTION_PACKAGE_NAME} has an invalid installed requirement: {raw_requirement}"
            ) from exc
        if canonicalize_name(requirement.name) != "spacy":
            continue
        if requirement.marker and not requirement.marker.evaluate({"extra": PII_PROCESSOR_EXTRA}):
            continue
        spacy_specifiers.append(str(requirement.specifier))

    if not spacy_specifiers:
        raise RuntimeError(f"{INGESTION_PACKAGE_NAME}[{PII_PROCESSOR_EXTRA}] does not declare a spaCy requirement")
    return SpecifierSet(",".join(spacy_specifiers))


def _installed_model_version(model_name: str) -> str | None:
    try:
        return version(model_name)
    except PackageNotFoundError:
        return None


def _verify_installed_model_version(specification: ModelSpecification) -> None:
    installed_version = _installed_model_version(specification.name)
    if installed_version != specification.version:
        raise RuntimeError(
            f"installed version is {installed_version or 'not installed'}, expected {specification.version}"
        )


def _install_model(specification: ModelSpecification, spacy_version: str) -> None:
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", prefix="openmetadata-spacy-", suffix=".txt", delete=False
    ) as constraints:
        constraints.write(f"spacy=={spacy_version}\n")
        constraints_path = Path(constraints.name)
    try:
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "--constraint",
                str(constraints_path),
                specification.wheel_url,
            ],
            check=False,
            capture_output=True,
            text=True,
        )
    finally:
        constraints_path.unlink(missing_ok=True)
    if result.returncode:
        details = (result.stderr or result.stdout).strip()[-2000:]
        raise RuntimeError(f"pip failed with exit code {result.returncode}: {details}")


def _verify_model_load(specification: ModelSpecification) -> None:
    script = """
import json
import spacy
import sys

model = spacy.load(sys.argv[1])
if "ner" not in model.pipe_names:
    raise RuntimeError("the model does not provide the required NER pipeline")
print(json.dumps({
    "spacy_version": spacy.__version__,
    "model_spacy_version": model.meta.get("spacy_version", ""),
    "version": model.meta.get("version", ""),
}))
"""
    result = subprocess.run(
        [sys.executable, "-c", script, specification.name],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode:
        details = (result.stderr or result.stdout).strip()[-2000:]
        raise RuntimeError(f"fresh model load failed: {details}")

    try:
        metadata = json.loads(result.stdout)
        declared_spacy_version = metadata["model_spacy_version"]
        if metadata["version"] != specification.version:
            raise RuntimeError(
                f"loaded model version is {metadata['version'] or 'unknown'}, expected {specification.version}"
            )
        installed_spacy_version = Version(metadata["spacy_version"])
        if not declared_spacy_version or installed_spacy_version not in SpecifierSet(declared_spacy_version):
            raise RuntimeError(
                f"model declares spaCy compatibility '{declared_spacy_version}', "
                f"but installed spaCy is {installed_spacy_version}"
            )
    except (InvalidVersion, json.JSONDecodeError, KeyError) as exc:
        raise RuntimeError("fresh model load did not report its spaCy compatibility") from exc


def _model_names(specifications: Sequence[ModelSpecification]) -> str:
    return ", ".join(specification.name for specification in specifications)


def _repair_action(specification: ModelSpecification, languages: Sequence[str]) -> str:
    uninstall = f"{shlex.quote(sys.executable)} -m pip uninstall {shlex.quote(specification.name)}"
    selection = ",".join(languages) if languages else "<supported-language>"
    rerun = f"metadata install-classification-models --languages {selection}"
    return f"Repair it with `{uninstall}`, then rerun `{rerun}`."


def _language_note(languages: Sequence[str]) -> str:
    return f" for language(s) {', '.join(languages)}" if languages else ""


def _report(progress: Callable[[str], None] | None, message: str) -> None:
    if progress:
        progress(message)
