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

"""Check profile requirements against real installed-distribution metadata."""

import importlib.metadata
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/check_python_environment.py"
SPEC = importlib.util.spec_from_file_location("check_python_environment", SCRIPT)
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


@pytest.fixture
def project(tmp_path):
    (tmp_path / "pyproject.toml").write_text("""
[project]
name = "fixture-app"
[dependency-groups]
test = ["sqlalchemy-ibmi==0.9.3"]
[tool.uv]
[[tool.uv.dependency-metadata]]
name = "sqlalchemy-ibmi"
version = "0.9.3"
requires-dist = ["pyodbc>=4.0", "sqlalchemy>=2.0,<2.1"]
[tool.openmetadata.python-environments]
forbidden-packages = ["pydoris-custom"]
[tool.openmetadata.python-environments.profiles.test]
groups = ["test"]
extras = []
install-project = false
[[tool.openmetadata.python-environments.metadata-exceptions]]
package = "sqlalchemy-ibmi"
version = "0.9.3"
dependency = "sqlalchemy"
declared = ">=1.3.0,<2.0"
accepted = ">=2.0,<2.1"
""")
    return tmp_path


def install(project, name, version, requirements=()):
    path = project / f"{name}-{version}.dist-info"
    path.mkdir()
    metadata = f"Metadata-Version: 2.1\nName: {name}\nVersion: {version}\n"
    metadata += "".join(f"Requires-Dist: {r}\n" for r in requirements)
    (path / "METADATA").write_text(metadata)


def check(project):
    return checker.check_environment(project, "test", importlib.metadata.distributions(path=[str(project)]))


def install_dialect(project, sqlalchemy="2.0.55", requirements=("pyodbc>=4.0", "sqlalchemy>=1.3.0,<2.0")):
    install(project, "sqlalchemy-ibmi", "0.9.3", requirements)
    install(project, "sqlalchemy", sqlalchemy)
    install(project, "pyodbc", "5.3.0")


def test_exact_dialect_exception_accepts_sqlalchemy_2(project):
    install_dialect(project)
    assert check(project) == []


def test_exception_rejects_sqlalchemy_outside_tested_minor(project):
    install_dialect(project, sqlalchemy="2.1.0")
    assert check(project) == ["sqlalchemy-ibmi requires sqlalchemy<2.1,>=2.0; installed 2.1.0"]


def test_exception_does_not_waive_a_missing_driver(project):
    install(project, "sqlalchemy-ibmi", "0.9.3", ("pyodbc>=4.0", "sqlalchemy>=1.3.0,<2.0"))
    install(project, "sqlalchemy", "2.0.55")
    assert check(project) == ["sqlalchemy-ibmi requires pyodbc>=4.0; package is missing"]


def test_exception_rejects_changed_upstream_metadata(project):
    install_dialect(project, requirements=("pyodbc>=5.0", "sqlalchemy>=1.3.0,<2.0"))
    assert "Metadata exception changes unrelated requirements: sqlalchemy-ibmi" in check(project)


def test_exception_rejects_changed_upstream_sqlalchemy_bound(project):
    install_dialect(project, requirements=("pyodbc>=4.0", "sqlalchemy<1.4"))
    assert "Metadata exception drifted: sqlalchemy-ibmi==0.9.3" in check(project)


def test_conflicting_doris_distribution_is_rejected(project):
    install_dialect(project)
    install(project, "pydoris-custom", "1.1.0")
    assert check(project) == ["Remove conflicting distribution: pydoris-custom"]


def test_transitive_extras_require_their_dependencies(project):
    install_dialect(project)
    install(project, "fixture-wrapper", "1.0", ("fixture-client[secure]",))
    install(project, "fixture-client", "1.0", ('fixture-security>=2; extra == "secure"',))
    assert check(project) == ['fixture-client requires fixture-security>=2; extra == "secure"; package is missing']


def test_inactive_extras_do_not_require_optional_dependencies(project):
    install_dialect(project)
    install(project, "fixture-client", "1.0", ('fixture-security>=2; extra == "secure"',))
    assert check(project) == []


def test_group_includes_cannot_recurse_forever():
    with pytest.raises(ValueError, match="Dependency-group cycle"):
        checker.group_requirements({"a": [{"include-group": "b"}], "b": [{"include-group": "a"}]}, "a")


@pytest.mark.parametrize("missing", [None, "en_core_web_md", "es_core_news_md", "it_core_news_md", "pl_core_news_md"])
def test_each_required_language_model_is_checked(project, missing):
    config = project / "pyproject.toml"
    config.write_text(
        config.read_text()
        + '\n[tool.openmetadata.python-environments.classification-models]\nlanguages = ["en", "es", "it", "pl"]\n'
    )
    install(project, "spacy", "3.8.16")
    for name in ["en_core_web_md", "es_core_news_md", "it_core_news_md", "pl_core_news_md"]:
        if name == missing:
            continue
        install(project, name, "3.8.0")
        path = project / name
        path.mkdir()
        (path / "meta.json").write_text(json.dumps({"version": "3.8.0", "spacy_version": ">=3.8.0,<3.9.0"}))
    errors = checker.check_classification_models(project, importlib.metadata.distributions(path=[str(project)]))
    assert errors == ([] if missing is None else [f"Missing classification model: {missing}==3.8.0"])


@pytest.mark.parametrize(
    "data_version,spacy_version,valid",
    [("3.8.0", "3.8.16", True), ("3.7.0", "3.8.16", False), ("3.8.0", "3.9.0", False)],
)
def test_model_data_and_runtime_must_match_the_release(project, data_version, spacy_version, valid):
    install(project, "en-core-web-md", "3.8.0")
    path = project / "en_core_web_md"
    path.mkdir()
    (path / "meta.json").write_text(json.dumps({"version": data_version, "spacy_version": ">=3.8.0,<3.9.0"}))
    distribution = importlib.metadata.Distribution.at(project / "en-core-web-md-3.8.0.dist-info")
    specification = SimpleNamespace(name="en_core_web_md", version="3.8.0", spacy_version=">=3.8.0,<3.9.0")
    errors = checker.check_model(distribution, specification, spacy_version)
    assert not errors if valid else errors
