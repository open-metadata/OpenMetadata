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
"""Service to publish validation results."""
# pyright: reportImportCycles=false

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Optional, cast

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.sdk import OpenMetadata
from metadata.sdk import client as get_client
from metadata.sdk.data_quality.dataframes.models import MockTestCase
from metadata.utils.entity_link import (
    get_entity_link,  # pyright: ignore[reportUnknownVariableType]
)
from metadata.utils.entity_link import maybe_get_column_from

if TYPE_CHECKING:
    from metadata.sdk.data_quality.dataframes.validation_results import ValidationResult

logger = logging.getLogger(__name__)


def push_validation_results(
    table_fqn: str,
    validation_result: ValidationResult,
    client: Optional[OpenMetadata] = None,
) -> None:
    if client is None:
        client = get_client()

    metadata = client.ometa

    for test_case, result in validation_result.test_cases_and_results:
        if isinstance(test_case, MockTestCase):
            test_case = metadata.get_or_create_test_case(
                test_case_fqn=f"{table_fqn}.{test_case.name.root}",
                entity_link=get_entity_link(
                    Table,
                    table_fqn,
                    column_name=maybe_get_column_from(test_case.entityLink.root),
                ),
                test_definition_fqn=test_case.testDefinition.fullyQualifiedName,
                test_case_parameter_values=test_case.parameterValues,
                description=getattr(test_case.description, "root", None),
            )

        res = metadata.add_test_case_results(
            result,
            cast(FullyQualifiedEntityName, test_case.fullyQualifiedName).root,
        )

        logger.debug(f"Result: {res}")
