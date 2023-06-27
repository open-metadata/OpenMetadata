from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.processor.sqlalchemy.bigquery_sampler import BigQuerySampler


class BigQueryProfilerInterface(SQAProfilerInterface):
    """
    Interface to interact with BigQuery registry.
    """

    _profiler_type: str = "BigQuery"

    def __init__(
        self,
        service_connection_config,
        ometa_client,
        entity,
        profile_sample_config,
        source_config,
        sample_query,
        table_partition_config,
        sqa_metadata=None,
        timeout_seconds=43200,
        thread_count=5,
        **kwargs,
    ):
        super().__init__(
            service_connection_config,
            ometa_client,
            entity,
            profile_sample_config,
            source_config,
            sample_query,
            table_partition_config,
            sqa_metadata,
            timeout_seconds,
            thread_count,
            **kwargs,
        )

    def _instantiate_sampler(
        self,
        session,
        table,
        sample_columns,
        profile_sample_config,
        partition_details,
        profile_sample_query,
    ):
        return BigQuerySampler(
            session=session,
            table=table,
            sample_columns=sample_columns,
            profile_sample_config=profile_sample_config,
            partition_details=partition_details,
            profile_sample_query=profile_sample_query,
        )
