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

import sys
from importlib.metadata import PackageNotFoundError
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.pii.model_provisioning import (
    MissingPIIProcessorDependencyError,
    ModelProvisioningError,
    _ingestion_spacy_version_specifier,
    _verify_model_load,
    _verify_pii_dependencies,
    _verify_spacy_compatibility,
    provision_classification_models,
)
from metadata.pii.model_registry import ModelSpecification, resolve_model_specifications


@pytest.fixture
def english_and_spanish():
    return resolve_model_specifications([ClassificationLanguage.en, ClassificationLanguage.es])


class TestModelProvisioning:
    def test_rejects_an_empty_selection(self):
        with pytest.raises(ValueError, match="At least one"):
            provision_classification_models([])

    def test_reuses_healthy_matching_models_offline(
        self,
        english_and_spanish,
    ):
        with (
            patch(
                "metadata.pii.model_provisioning.version",
                side_effect=lambda package: {
                    "spacy": "3.8.16",
                    "presidio-analyzer": "2.2.358",
                    "en_core_web_md": "3.8.0",
                    "es_core_news_md": "3.8.0",
                }[package],
            ),
            patch(
                "metadata.pii.model_provisioning.subprocess.run",
                return_value=SimpleNamespace(
                    returncode=0,
                    stdout='{"spacy_version": "3.8.16", "model_spacy_version": ">=3.8.0,<3.9.0", "version": "3.8.0"}',
                    stderr="",
                ),
            ) as mock_run,
        ):
            result = provision_classification_models(english_and_spanish)

        assert result.completed == english_and_spanish
        assert result.installed == []
        assert mock_run.call_count == 2

    def test_replaces_a_different_installed_version(
        self,
        english_and_spanish,
    ):
        installed_model_versions = iter(["3.8.1", "3.8.0"])

        def installed_version(package):
            if package == "en_core_web_md":
                return next(installed_model_versions)
            return {"spacy": "3.8.16", "presidio-analyzer": "2.2.358"}[package]

        with (
            patch(
                "metadata.pii.model_provisioning.version",
                side_effect=installed_version,
            ),
            patch(
                "metadata.pii.model_provisioning.subprocess.run",
                side_effect=[
                    SimpleNamespace(returncode=0, stdout="", stderr=""),
                    SimpleNamespace(
                        returncode=0,
                        stdout='{"spacy_version": "3.8.16", "model_spacy_version": ">=3.8.0,<3.9.0", "version": "3.8.0"}',
                        stderr="",
                    ),
                ],
            ) as mock_run,
        ):
            result = provision_classification_models([english_and_spanish[0]])

        assert result.installed == [english_and_spanish[0]]
        assert mock_run.call_args_list[0].args[0][2:4] == ["pip", "install"]

    def test_rejects_incompatible_spacy_before_install(self, english_and_spanish):
        with (
            patch(
                "metadata.pii.model_provisioning.version",
                side_effect=lambda package: {"spacy": "3.7.9", "presidio-analyzer": "2.2.358"}[package],
            ),
            patch("metadata.pii.model_provisioning.subprocess.run") as mock_run,
            pytest.raises(RuntimeError, match=r"spaCy 3.7.9"),
        ):
            provision_classification_models(english_and_spanish, {"en_core_web_md": ["en"]})

        mock_run.assert_not_called()

    def test_stops_after_first_failure_and_reports_remaining_models(
        self,
        english_and_spanish,
    ):
        def installed_version(package):
            if package in {"spacy", "presidio-analyzer"}:
                return {"spacy": "3.8.16", "presidio-analyzer": "2.2.358"}[package]
            raise PackageNotFoundError

        with (
            patch("metadata.pii.model_provisioning.version", side_effect=installed_version),
            patch(
                "metadata.pii.model_provisioning.subprocess.run",
                return_value=SimpleNamespace(returncode=1, stdout="", stderr="wheel unavailable"),
            ) as mock_run,
            pytest.raises(ModelProvisioningError) as error,
        ):
            provision_classification_models(english_and_spanish, {"en_core_web_md": ["en"]})

        assert error.value.completed == []
        assert error.value.failed == english_and_spanish[0]
        assert error.value.unattempted == [english_and_spanish[1]]
        assert "language(s) en" in str(error.value)
        assert "wheel unavailable" in str(error.value)
        mock_run.assert_called_once()

    def test_matching_but_corrupt_model_requires_repair(self, english_and_spanish):
        with (
            patch(
                "metadata.pii.model_provisioning.version",
                side_effect=lambda package: {
                    "spacy": "3.8.16",
                    "presidio-analyzer": "2.2.358",
                    "en_core_web_md": "3.8.0",
                }[package],
            ),
            patch(
                "metadata.pii.model_provisioning.subprocess.run",
                return_value=SimpleNamespace(returncode=1, stdout="", stderr="bad model"),
            ),
            pytest.raises(ModelProvisioningError) as error,
        ):
            provision_classification_models([english_and_spanish[0]], {"en_core_web_md": ["en"]})

        assert f"{sys.executable} -m pip uninstall en_core_web_md" in str(error.value)
        assert "metadata install-classification-models --languages en" in str(error.value)

    def test_reports_a_period_terminated_failure_without_doubled_punctuation(self, english_and_spanish):
        error = ModelProvisioningError(
            english_and_spanish[0],
            "model verification failed.",
            completed=[],
            unattempted=[],
            languages=["en"],
        )

        assert "model verification failed.." not in str(error)

    def test_reports_model_version_reconciliation_and_languages(
        self,
        english_and_spanish,
    ):
        progress = Mock()
        installed_model_versions = iter(["3.8.1", "3.8.0"])

        def installed_version(package):
            if package == "en_core_web_md":
                return next(installed_model_versions)
            return {"spacy": "3.8.16", "presidio-analyzer": "2.2.358"}[package]

        with (
            patch(
                "metadata.pii.model_provisioning.version",
                side_effect=installed_version,
            ),
            patch(
                "metadata.pii.model_provisioning.subprocess.run",
                side_effect=[
                    SimpleNamespace(returncode=0, stdout="", stderr=""),
                    SimpleNamespace(
                        returncode=0,
                        stdout='{"spacy_version": "3.8.16", "model_spacy_version": ">=3.8.0,<3.9.0", "version": "3.8.0"}',
                        stderr="",
                    ),
                ],
            ),
        ):
            provision_classification_models([english_and_spanish[0]], {"en_core_web_md": ["en", "any"]}, progress)

        progress.assert_any_call("Reconciling en_core_web_md for language(s) en, any from 3.8.1 to 3.8.0")


class TestPipInstallation:
    @patch("metadata.pii.model_provisioning.subprocess.run")
    @patch("metadata.pii.model_provisioning.sys.executable", "/venv/bin/python")
    def test_installs_exact_wheel_with_current_spacy_constraint(self, mock_run, english_and_spanish):
        def assert_constraint(command, **_kwargs):
            assert Path(command[5]).read_text(encoding="utf-8") == "spacy==3.8.16\n"
            return SimpleNamespace(returncode=0, stdout="", stderr="")

        mock_run.side_effect = assert_constraint

        from metadata.pii.model_provisioning import _install_model

        _install_model(english_and_spanish[0], "3.8.16")

        command = mock_run.call_args.args[0]
        assert command[:5] == ["/venv/bin/python", "-m", "pip", "install", "--constraint"]
        assert english_and_spanish[0].wheel_url in command
        assert "--upgrade" not in command
        assert "--force-reinstall" not in command

    @patch("metadata.pii.model_provisioning.subprocess.run")
    def test_reports_concise_pip_failure(self, mock_run, english_and_spanish):
        mock_run.return_value = SimpleNamespace(returncode=1, stdout="", stderr="a" * 5000)

        from metadata.pii.model_provisioning import _install_model

        with pytest.raises(RuntimeError, match="pip failed") as error:
            _install_model(english_and_spanish[0], "3.8.16")

        assert len(str(error.value)) < 2500


class TestFreshModelVerification:
    @patch("metadata.pii.model_provisioning.subprocess.run")
    def test_checks_loaded_model_version_and_compatibility(self, mock_run, english_and_spanish):
        mock_run.return_value = SimpleNamespace(
            returncode=0,
            stdout='{"spacy_version": "3.8.16", "model_spacy_version": ">=3.8.0,<3.9.0", "version": "3.8.0"}',
            stderr="",
        )

        _verify_model_load(english_and_spanish[0])

        assert mock_run.call_args.args[0][-1] == "en_core_web_md"

    @patch("metadata.pii.model_provisioning.subprocess.run")
    def test_rejects_a_loaded_model_with_the_wrong_version(self, mock_run, english_and_spanish):
        mock_run.return_value = SimpleNamespace(
            returncode=0,
            stdout='{"spacy_version": "3.8.16", "model_spacy_version": ">=3.8.0,<3.9.0", "version": "3.8.1"}',
            stderr="",
        )

        with pytest.raises(RuntimeError, match="loaded model version"):
            _verify_model_load(english_and_spanish[0])

    @patch("metadata.pii.model_provisioning.subprocess.run")
    def test_uses_the_spacy_version_reported_by_the_fresh_process(self, mock_run, english_and_spanish):
        mock_run.return_value = SimpleNamespace(
            returncode=0,
            stdout='{"spacy_version": "3.7.9", "model_spacy_version": ">=3.8.0,<3.9.0", "version": "3.8.0"}',
            stderr="",
        )

        with pytest.raises(RuntimeError, match="model declares spaCy compatibility"):
            _verify_model_load(english_and_spanish[0])

    @patch("metadata.pii.model_provisioning.subprocess.run")
    def test_reports_a_failed_fresh_process_load(self, mock_run, english_and_spanish):
        mock_run.return_value = SimpleNamespace(returncode=1, stdout="", stderr="could not import")

        with pytest.raises(RuntimeError, match="fresh model load failed"):
            _verify_model_load(english_and_spanish[0])

    @patch("metadata.pii.model_provisioning.subprocess.run")
    def test_reports_missing_fresh_process_metadata(self, mock_run, english_and_spanish):
        mock_run.return_value = SimpleNamespace(returncode=0, stdout="not-json", stderr="")

        with pytest.raises(RuntimeError, match="did not report"):
            _verify_model_load(english_and_spanish[0])


class TestPIIDependencyPreflight:
    @patch("metadata.pii.model_provisioning.distribution")
    def test_rejects_an_installed_spacy_version_excluded_by_the_pii_processor_extra(
        self, mock_distribution, english_and_spanish
    ):
        mock_distribution.return_value = SimpleNamespace(
            requires=[
                "spacy>=3.7,<3.8; extra == 'other-extra'",
                "spacy>=3.7; extra == 'pii-processor' and python_version < '3.10'",
                "spacy>=3.8.10,<3.9; extra == 'pii-processor' and python_version >= '3.10'",
            ]
        )
        with (
            patch(
                "metadata.pii.model_provisioning.version",
                side_effect=lambda package: {"spacy": "3.8.9", "presidio-analyzer": "2.2.358"}[package],
            ),
            patch("metadata.pii.model_provisioning.subprocess.run") as mock_run,
            pytest.raises(RuntimeError, match=r"spaCy 3.8.9"),
        ):
            provision_classification_models(english_and_spanish)

        mock_run.assert_not_called()

    @patch("metadata.pii.model_provisioning.distribution")
    def test_explains_when_the_pii_processor_extra_has_no_spacy_requirement(self, mock_distribution):
        mock_distribution.return_value = SimpleNamespace(requires=["presidio-analyzer; extra == 'pii-processor'"])

        with pytest.raises(RuntimeError, match="does not declare a spaCy requirement"):
            _ingestion_spacy_version_specifier()

    @patch("metadata.pii.model_provisioning.distribution", side_effect=PackageNotFoundError)
    def test_explains_when_the_ingestion_package_metadata_is_unavailable(self, mock_distribution):
        with pytest.raises(RuntimeError, match="Could not read requirements"):
            _ingestion_spacy_version_specifier()

    @patch("metadata.pii.model_provisioning.distribution")
    def test_explains_invalid_installed_package_metadata(self, mock_distribution):
        mock_distribution.return_value = SimpleNamespace(requires=["spacy===not a version"])

        with pytest.raises(RuntimeError, match="invalid installed requirement"):
            _ingestion_spacy_version_specifier()

    @patch("metadata.pii.model_provisioning.version", side_effect=PackageNotFoundError)
    def test_explains_missing_pii_dependencies(self, mock_version):
        with pytest.raises(MissingPIIProcessorDependencyError, match="pii-processor"):
            _verify_pii_dependencies()

    def test_rejects_invalid_and_incompatible_spacy_versions(self, english_and_spanish):
        with pytest.raises(RuntimeError, match="invalid"):
            _verify_spacy_compatibility("not-a-version", english_and_spanish)

        incompatible_specification = ModelSpecification("example", "3.8.0", ">=3.9.0,<4.0")
        with pytest.raises(RuntimeError, match="incompatible"):
            _verify_spacy_compatibility("3.8.16", [incompatible_specification])
