"""ClickZetta capability registration contract tests."""

import importlib
import json
import sys
from pathlib import Path
from types import ModuleType

import metadata.ingestion.source.database as database_source_package

database_source_package.__path__.append(
    str(Path(__file__).resolve().parents[4] / "src/metadata/ingestion/source/database")
)

_CLICKZETTA_CONFIG_MODULE = "metadata.generated.schema.entity.services.connections.database.clickzettaConnection"
try:
    importlib.import_module(_CLICKZETTA_CONFIG_MODULE)
except ModuleNotFoundError:
    generated_module = ModuleType(_CLICKZETTA_CONFIG_MODULE)

    class ClickzettaConnection:
        pass

    generated_module.ClickzettaConnection = ClickzettaConnection
    sys.modules[_CLICKZETTA_CONFIG_MODULE] = generated_module

from metadata.data_quality.interface.sqlalchemy.clickzetta.test_suite_interface import (  # noqa: E402
    ClickzettaTestSuiteInterface,
)
from metadata.generated.schema.entity.services.connections.database.clickzettaConnection import (  # noqa: E402
    ClickzettaConnection,
)
from metadata.ingestion.source.database.clickzetta.data_diff.table_parameter import (  # noqa: E402
    ClickzettaTableParameter,
)
from metadata.ingestion.source.database.clickzetta.service_spec import ServiceSpec  # noqa: E402
from metadata.profiler.interface.sqlalchemy.clickzetta.profiler_interface import (  # noqa: E402
    ClickzettaProfilerInterface,
)
from metadata.sampler.sqlalchemy.clickzetta.sampler import ClickzettaSampler  # noqa: E402
from metadata.utils.importer import get_class_path  # noqa: E402


def test_clickzetta_registers_guarded_data_capability_adapters():
    """All registered data capabilities use ClickZetta-specific guarded adapters."""
    assert ServiceSpec.profiler_class == get_class_path(ClickzettaProfilerInterface)
    assert ServiceSpec.sampler_class == get_class_path(ClickzettaSampler)
    assert ServiceSpec.test_suite_class == get_class_path(ClickzettaTestSuiteInterface)
    assert ServiceSpec.data_diff == get_class_path(ClickzettaTableParameter)


def test_clickzetta_dbt_flag_defaults_to_disabled():
    """DBT artifacts use the separate DBT source until attached UI support is validated."""
    schema_path = (
        Path(__file__).resolve().parents[5]
        / "openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json"
    )
    schema = json.loads(schema_path.read_text())
    assert schema["properties"]["supportsDBTExtraction"]["default"] is False
    assert schema["properties"]["supportsProfiler"]["default"] is True
    assert schema["properties"]["supportsDataDiff"]["default"] is True

    if not hasattr(ClickzettaConnection, "model_validate"):
        return

    config = ClickzettaConnection.model_validate(
        {
            "hostPort": "instance.example.clickzetta.test",
            "username": "catalog_reader",
            "authType": {"password": "not-used-in-this-test"},
            "databaseName": "quick_start",
            "virtualCluster": "DEFAULT_AP",
        }
    )

    assert config.supportsDBTExtraction is False
    # Generated models are ignored by git and can lag the schema in a local
    # checkout until `make generate` is run. Validate the generated defaults
    # when those fields are available, while keeping this source-schema test
    # runnable in a clean checkout.
    if hasattr(config, "supportsProfiler"):
        assert config.supportsProfiler is True
    if hasattr(config, "supportsDataDiff"):
        assert config.supportsDataDiff is True
