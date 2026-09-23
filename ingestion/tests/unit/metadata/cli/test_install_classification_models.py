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

import logging
from unittest.mock import patch

import pytest

from metadata.cmd import get_parser, metadata
from metadata.pii.model_provisioning import ProvisioningResult
from metadata.pii.model_registry import (
    parse_classification_languages,
    resolve_model_specifications,
)


class TestInstallClassificationModelsCommand:
    def test_parser_requires_languages_and_does_not_require_a_config(self):
        arguments = get_parser(["install-classification-models", "--languages", "en,es"])

        assert arguments.command == "install-classification-models"
        assert arguments.languages == "en,es"
        assert not hasattr(arguments, "config")

    def test_parser_rejects_missing_languages(self):
        with pytest.raises(SystemExit):
            get_parser(["install-classification-models"])

    @patch("metadata.cli.install_classification_models.provision_classification_models")
    def test_handler_parses_and_provisions_without_workflow_dependencies(self, mock_provision):
        from metadata.cli.install_classification_models import run_install_classification_models

        expected = resolve_model_specifications(parse_classification_languages("en,es"))
        mock_provision.return_value = ProvisioningResult(completed=expected, installed=expected)

        result = run_install_classification_models("en,es")

        assert result == mock_provision.return_value
        assert mock_provision.call_args.args[0] == expected

    @patch("metadata.cli.install_classification_models.run_install_classification_models")
    def test_command_dispatches_independently_of_config_paths(self, mock_run):
        metadata(["install-classification-models", "--languages", "en"])

        mock_run.assert_called_once_with("en")

    @patch("metadata.cli.install_classification_models.provision_classification_models")
    def test_handler_reports_when_models_are_already_available(self, mock_provision, caplog):
        from metadata.cli.install_classification_models import run_install_classification_models

        completed = resolve_model_specifications(parse_classification_languages("en"))
        mock_provision.return_value = ProvisioningResult(completed=completed, installed=[])
        caplog.set_level(logging.INFO)

        run_install_classification_models("en")

        assert "Auto classification models already available: en_core_web_md" in caplog.text

    @patch(
        "metadata.cli.install_classification_models.run_install_classification_models",
        side_effect=ImportError("unrelated import failure"),
    )
    def test_command_propagates_unrelated_import_errors(self, mock_run):
        with pytest.raises(ImportError, match="unrelated import failure"):
            metadata(["install-classification-models", "--languages", "en"])

    @patch(
        "metadata.cli.install_classification_models.run_install_classification_models",
        side_effect=RuntimeError("dependency failure"),
    )
    def test_command_returns_a_nonzero_exit_for_provisioning_failure(self, mock_run):
        with pytest.raises(SystemExit, match="1"):
            metadata(["install-classification-models", "--languages", "en"])
