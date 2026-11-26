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
"""
Salesforce Data 360 pipeline metadata ingestion source
"""

from metadata.ingestion.source.pipeline.data360pipeline.lineage import (
    Data360PipelineLineageMixin,
)
from metadata.ingestion.source.pipeline.data360pipeline.operational import (
    Data360PipelineStatusMixin,
)


class Data360PipelineSource(  # pyright: ignore[reportIncompatibleMethodOverride]
    Data360PipelineLineageMixin, Data360PipelineStatusMixin
):
    """
    Extracts DataStreams, Calculated Insights and DataTransforms as pipelines, with
    their run status and lineage, in one metadata run, as every other pipeline
    service does. Lineage follows the standard `includeLineage` option.
    """
