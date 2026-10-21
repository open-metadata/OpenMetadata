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
"""CLI handler for pre-provisioning Auto Classification spaCy models."""

from metadata.pii.model_provisioning import (
    ProvisioningResult,
    provision_classification_models,
)
from metadata.pii.model_registry import (
    ModelSpecification,
    languages_by_model,
    parse_classification_languages,
    resolve_model_specifications,
)
from metadata.utils.logger import cli_logger

logger = cli_logger()


def run_install_classification_models(languages: str) -> ProvisioningResult:
    """Provision the release-pinned models selected by the CLI argument."""
    selected_languages = parse_classification_languages(languages)
    specifications = resolve_model_specifications(selected_languages)
    result = provision_classification_models(
        specifications,
        languages_by_model(selected_languages),
        logger.info,
    )
    if result.installed:
        logger.info("Provisioned auto classification models: %s", _names(result.installed))
    else:
        logger.info("Auto classification models already available: %s", _names(result.completed))
    return result


def _names(result: list[ModelSpecification]) -> str:
    return ", ".join(specification.name for specification in result)
