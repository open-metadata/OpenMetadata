#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Model-operation errors remain distinguishable from classification failures."""

from unittest.mock import Mock

import pytest
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_analyzer.nlp_engine import SpacyNlpEngine

from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage
from metadata.pii.algorithms import presidio_utils
from metadata.pii.model_loading import ClassificationModelLoadError


@pytest.fixture(autouse=True)
def clear_model_cache():
    presidio_utils.load_nlp_engine.cache_clear()
    yield
    presidio_utils.load_nlp_engine.cache_clear()


@pytest.mark.parametrize(
    ("loads", "download_error", "phase"),
    [
        ([ValueError("invalid model config")], None, "local_load"),
        ([OSError("missing")], ConnectionError("https://user:secret@example.test"), "download"),
        ([OSError("missing")], SystemExit(1), "download"),
        ([OSError("missing"), ValueError("corrupt model")], None, "reload"),
    ],
)
def test_failed_model_operation_has_actionable_sanitized_error(monkeypatch, loads, download_error, phase):
    monkeypatch.setattr(presidio_utils.spacy, "load", Mock(side_effect=loads))
    monkeypatch.setattr(presidio_utils, "download", Mock(side_effect=download_error))

    with pytest.raises(ClassificationModelLoadError) as failure:
        presidio_utils.load_nlp_engine(classification_language=ClassificationLanguage.en)

    error = failure.value
    assert error.model_name == "en_core_web_md"
    assert error.requested_language == "en"
    assert error.effective_language == "en"
    assert error.phase == phase
    assert error.__cause__ is (download_error if phase == "download" else loads[-1])
    assert presidio_utils.download.call_count == (0 if phase == "local_load" else 1)
    assert f"Cause type: {type(error.__cause__).__name__}" in str(error)
    assert "metadata install-classification-models --languages en" in str(error)
    assert "secret" not in str(error)
    assert "unavailable" in str(error)


def test_engine_is_ready_before_return_and_not_loaded_again_by_analyzer(monkeypatch):
    import spacy

    nlp = spacy.blank("en")
    monkeypatch.setattr(presidio_utils.spacy, "load", lambda _: nlp)
    monkeypatch.setattr(SpacyNlpEngine, "_download_spacy_model_if_needed", staticmethod(lambda _: None))

    engine = presidio_utils.load_nlp_engine(classification_language=ClassificationLanguage.en)

    assert engine.is_loaded()
    assert engine.get_supported_languages() == ["en"]
    assert engine.get_nlp("en") is nlp
    monkeypatch.setattr(engine, "load", Mock(side_effect=AssertionError("unexpected deferred load")))
    analyzer = AnalyzerEngine(
        nlp_engine=engine,
        registry=RecognizerRegistry(recognizers=[], supported_languages=["en"]),
        supported_languages=["en"],
    )
    assert analyzer.nlp_engine is engine


def test_engine_load_failure_is_not_cached_and_next_run_can_recover(monkeypatch):
    monkeypatch.setattr(presidio_utils, "_load_spacy_model", lambda *_: None)
    broken = Mock(spec=SpacyNlpEngine)
    broken.load.side_effect = OSError("model disappeared")
    healthy = Mock(spec=SpacyNlpEngine)
    engines = iter([broken, healthy])
    monkeypatch.setattr(presidio_utils, "SpacyNlpEngine", lambda **_: next(engines))

    with pytest.raises(ClassificationModelLoadError) as failure:
        presidio_utils.load_nlp_engine(classification_language=ClassificationLanguage.en)
    assert failure.value.phase == "engine_load"
    assert presidio_utils.load_nlp_engine(classification_language=ClassificationLanguage.en) is healthy
    assert presidio_utils.load_nlp_engine.cache_info().currsize == 1
    assert presidio_utils.load_nlp_engine.cache_info().maxsize == 32


@pytest.mark.parametrize("fatal", [MemoryError("exhausted"), KeyboardInterrupt(), GeneratorExit()])
@pytest.mark.parametrize("phase", ["local_load", "download", "reload", "engine_load"])
def test_process_and_resource_signals_are_not_model_availability_errors(monkeypatch, fatal, phase):
    load = Mock(
        side_effect=fatal if phase == "local_load" else [OSError("missing"), fatal if phase == "reload" else object()]
    )
    monkeypatch.setattr(presidio_utils.spacy, "load", load)
    monkeypatch.setattr(presidio_utils, "download", Mock(side_effect=fatal if phase == "download" else None))
    if phase == "engine_load":
        monkeypatch.setattr(presidio_utils, "_load_spacy_model", lambda *_: None)
        engine = Mock(spec=SpacyNlpEngine)
        engine.load.side_effect = fatal
        monkeypatch.setattr(presidio_utils, "SpacyNlpEngine", lambda **_: engine)

    with pytest.raises(type(fatal)):
        presidio_utils.load_nlp_engine(classification_language=ClassificationLanguage.en)


def test_successful_downloader_exit_still_verifies_the_model(monkeypatch):
    monkeypatch.setattr(
        presidio_utils.spacy, "load", Mock(side_effect=[OSError("missing"), ValueError("still broken")])
    )
    monkeypatch.setattr(presidio_utils, "download", Mock(side_effect=SystemExit(0)))

    with pytest.raises(ClassificationModelLoadError) as failure:
        presidio_utils.load_nlp_engine(classification_language=ClassificationLanguage.en)

    assert failure.value.phase == "reload"


@pytest.mark.parametrize("download_error", [None, SystemExit(0)])
def test_missing_model_is_loaded_downloaded_then_verified(monkeypatch, download_error):
    operations = []

    def load(model_name):
        operations.append(("load", model_name))
        if len(operations) == 1:
            raise OSError("missing")
        return object()

    def download(model_name):
        operations.append(("download", model_name))
        if download_error is not None:
            raise download_error

    monkeypatch.setattr(presidio_utils.spacy, "load", load)
    monkeypatch.setattr(presidio_utils, "download", download)

    assert presidio_utils._load_spacy_model("en_core_web_md") is None
    assert operations == [
        ("load", "en_core_web_md"),
        ("download", "en_core_web_md"),
        ("load", "en_core_web_md"),
    ]


def test_real_missing_model_with_unavailable_download_is_typed(tmp_path, monkeypatch):
    model_path = str(tmp_path / "absent_model")
    monkeypatch.setattr(presidio_utils, "download", Mock(side_effect=ConnectionError("offline")))
    with pytest.raises(ClassificationModelLoadError) as failure:
        presidio_utils.load_nlp_engine(model_name=model_path, supported_language="en")
    assert failure.value.phase == "download"
    assert failure.value.model_name == model_path
    assert isinstance(failure.value.__cause__, ConnectionError)
