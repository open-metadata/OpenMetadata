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

from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (  # noqa: E402
    SQATestSuiteInterface,
)
from metadata.generated.schema.entity.services.connections.database.clickzettaConnection import (  # noqa: E402
    ClickzettaConnection,
)
from metadata.ingestion.source.database.clickzetta.data_diff.table_parameter import (  # noqa: E402
    ClickzettaTableParameter,
)
from metadata.ingestion.source.database.clickzetta.service_spec import ServiceSpec  # noqa: E402
from metadata.profiler.interface.sqlalchemy.profiler_interface import (  # noqa: E402
    SQAProfilerInterface,
)
from metadata.sampler.sqlalchemy.clickzetta.sampler import ClickzettaSampler  # noqa: E402
from metadata.utils.importer import get_class_path  # noqa: E402


def test_clickzetta_registers_standard_data_capabilities_with_a_native_sampler():
    """Use OpenMetadata defaults unless ClickZetta needs dialect-specific SQL."""
    assert ServiceSpec.profiler_class == get_class_path(SQAProfilerInterface)
    assert ServiceSpec.sampler_class == get_class_path(ClickzettaSampler)
    assert ServiceSpec.test_suite_class == get_class_path(SQATestSuiteInterface)
    assert ServiceSpec.data_diff == get_class_path(ClickzettaTableParameter)


def test_clickzetta_capability_flags_use_standard_enabled_defaults():
    schema_path = (
        Path(__file__).resolve().parents[5]
        / "openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json"
    )
    schema = json.loads(schema_path.read_text())
    for field in ("supportsDBTExtraction", "supportsProfiler", "supportsDataDiff"):
        assert "default" not in schema["properties"][field]

    basic_schema_path = schema_path.parent.parent / "connectionBasicType.json"
    basic_schema = json.loads(basic_schema_path.read_text())
    for field in ("supportsDBTExtraction", "supportsProfiler", "supportsDataDiff"):
        assert basic_schema["definitions"][field]["default"] is True

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

    assert hasattr(config, "supportsDBTExtraction")
    assert hasattr(config, "supportsProfiler")
    assert hasattr(config, "supportsDataDiff")
