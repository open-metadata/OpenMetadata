"""OpenMetadata runtime-parameter adapter for ClickZetta table diff."""

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.ingestion.source.database.clickzetta.data_diff.data_diff import (
    register_clickzetta_data_diff,
)

# Register only when OpenMetadata explicitly imports this data-diff parameter
# class through a service spec.  Merely installing the connector has no effect.
register_clickzetta_data_diff()


class ClickzettaTableParameter(BaseTableParameter):
    """Use the shared OpenMetadata table-parameter construction."""
