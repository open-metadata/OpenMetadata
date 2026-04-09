"""
Tests for the OpenLineage service resolver module.
"""

from unittest.mock import MagicMock

from metadata.generated.schema.entity.services.pipelineService import (
    PipelineServiceType,
)
from metadata.ingestion.source.pipeline.openlineage.models import OpenLineageEvent
from metadata.ingestion.source.pipeline.openlineage.service_resolver import (
    build_service_name,
    extract_integration_type,
    find_pipeline_by_namespace,
    get_or_create_pipeline_service,
    resolve_pipeline_service_type,
)


class TestExtractIntegrationType:
    def test_extracts_from_job_type_integration(self):
        event = OpenLineageEvent(
            run_facet={},
            job={
                "name": "my_job",
                "namespace": "test",
                "facets": {
                    "jobType": {
                        "integration": "SPARK",
                        "jobType": "JOB",
                        "processingType": "BATCH",
                    }
                },
            },
            event_type="COMPLETE",
            inputs=[],
            outputs=[],
        )
        assert extract_integration_type(event) == "spark"

    def test_extracts_flink(self):
        event = OpenLineageEvent(
            run_facet={},
            job={
                "name": "flink_job",
                "namespace": "test",
                "facets": {
                    "jobType": {
                        "integration": "FLINK",
                        "jobType": "JOB",
                        "processingType": "STREAMING",
                    }
                },
            },
            event_type="COMPLETE",
            inputs=[],
            outputs=[],
        )
        assert extract_integration_type(event) == "flink"

    def test_extracts_airflow(self):
        event = OpenLineageEvent(
            run_facet={},
            job={
                "name": "my_dag",
                "namespace": "airflow",
                "facets": {
                    "jobType": {
                        "integration": "AIRFLOW",
                        "jobType": "DAG",
                    }
                },
            },
            event_type="COMPLETE",
            inputs=[],
            outputs=[],
        )
        assert extract_integration_type(event) == "airflow"

    def test_returns_none_when_no_facets(self):
        event = OpenLineageEvent(
            run_facet={},
            job={"name": "my_job", "namespace": "test"},
            event_type="COMPLETE",
            inputs=[],
            outputs=[],
        )
        assert extract_integration_type(event) is None

    def test_returns_none_when_no_job_type(self):
        event = OpenLineageEvent(
            run_facet={},
            job={
                "name": "my_job",
                "namespace": "test",
                "facets": {"sql": {"query": "SELECT 1"}},
            },
            event_type="COMPLETE",
            inputs=[],
            outputs=[],
        )
        assert extract_integration_type(event) is None

    def test_returns_none_when_integration_is_empty(self):
        event = OpenLineageEvent(
            run_facet={},
            job={
                "name": "my_job",
                "namespace": "test",
                "facets": {"jobType": {"integration": ""}},
            },
            event_type="COMPLETE",
            inputs=[],
            outputs=[],
        )
        assert extract_integration_type(event) is None

    def test_handles_case_insensitive(self):
        event = OpenLineageEvent(
            run_facet={},
            job={
                "name": "my_job",
                "namespace": "test",
                "facets": {"jobType": {"integration": "Spark"}},
            },
            event_type="COMPLETE",
            inputs=[],
            outputs=[],
        )
        assert extract_integration_type(event) == "spark"


class TestResolvePipelineServiceType:
    def test_spark(self):
        assert resolve_pipeline_service_type("spark") == PipelineServiceType.Spark

    def test_flink(self):
        assert resolve_pipeline_service_type("flink") == PipelineServiceType.Flink

    def test_airflow(self):
        assert resolve_pipeline_service_type("airflow") == PipelineServiceType.Airflow

    def test_dbt(self):
        assert resolve_pipeline_service_type("dbt") == PipelineServiceType.DBTCloud

    def test_unknown_falls_back_to_openlineage(self):
        assert (
            resolve_pipeline_service_type("unknown") == PipelineServiceType.OpenLineage
        )

    def test_none_falls_back_to_openlineage(self):
        assert resolve_pipeline_service_type(None) == PipelineServiceType.OpenLineage


class TestBuildServiceName:
    def test_known_integration(self):
        assert build_service_name("spark", "my_ol_service") == "spark_openlineage"

    def test_flink_integration(self):
        assert build_service_name("flink", "my_ol_service") == "flink_openlineage"

    def test_unknown_integration_uses_fallback(self):
        assert build_service_name("unknown_engine", "my_ol_service") == "my_ol_service"

    def test_none_integration_uses_fallback(self):
        assert build_service_name(None, "my_ol_service") == "my_ol_service"


class TestGetOrCreatePipelineService:
    def test_returns_from_cache(self):
        metadata = MagicMock()
        cache = {"spark_openlineage": "spark_openlineage"}

        result = get_or_create_pipeline_service(
            metadata, "spark_openlineage", PipelineServiceType.Spark, cache
        )

        assert result == "spark_openlineage"
        metadata.get_by_name.assert_not_called()

    def test_returns_existing_service(self):
        metadata = MagicMock()
        metadata.get_by_name.return_value = MagicMock()
        cache = {}

        result = get_or_create_pipeline_service(
            metadata, "spark_openlineage", PipelineServiceType.Spark, cache
        )

        assert result == "spark_openlineage"
        assert "spark_openlineage" in cache
        metadata.create_or_update.assert_not_called()

    def test_creates_service_when_not_found(self):
        metadata = MagicMock()
        metadata.get_by_name.return_value = None
        cache = {}

        result = get_or_create_pipeline_service(
            metadata, "spark_openlineage", PipelineServiceType.Spark, cache
        )

        assert result == "spark_openlineage"
        assert "spark_openlineage" in cache
        metadata.create_or_update.assert_called_once()
        request = metadata.create_or_update.call_args[0][0]
        assert request.name.root == "spark_openlineage"
        assert request.serviceType == PipelineServiceType.Spark


class TestFindPipelineByNamespace:
    def _make_event(self, namespace="airflow_prod", name="my_dag"):
        return OpenLineageEvent(
            run_facet={},
            job={"name": name, "namespace": namespace},
            event_type="COMPLETE",
            inputs=[],
            outputs=[],
        )

    def test_finds_existing_pipeline(self):
        metadata = MagicMock()
        pipeline = MagicMock()
        metadata.get_by_name.return_value = pipeline

        result = find_pipeline_by_namespace(metadata, self._make_event())

        assert result is not None
        service_name, found_pipeline = result
        assert service_name == "airflow_prod"
        assert found_pipeline is pipeline
        metadata.get_by_name.assert_called_once()

    def test_returns_none_when_not_found(self):
        metadata = MagicMock()
        metadata.get_by_name.return_value = None

        result = find_pipeline_by_namespace(metadata, self._make_event())

        assert result is None

    def test_returns_none_when_no_namespace(self):
        metadata = MagicMock()
        event = self._make_event(namespace=None)

        result = find_pipeline_by_namespace(metadata, event)

        assert result is None
        metadata.get_by_name.assert_not_called()

    def test_returns_none_when_no_name(self):
        metadata = MagicMock()
        event = self._make_event(name=None)

        result = find_pipeline_by_namespace(metadata, event)

        assert result is None
        metadata.get_by_name.assert_not_called()

    def test_uses_namespace_dot_name_as_fqn(self):
        metadata = MagicMock()
        metadata.get_by_name.return_value = None

        find_pipeline_by_namespace(
            metadata, self._make_event(namespace="my_airflow", name="etl_dag")
        )

        from metadata.generated.schema.entity.data.pipeline import Pipeline

        metadata.get_by_name.assert_called_once_with(Pipeline, "my_airflow.etl_dag")
