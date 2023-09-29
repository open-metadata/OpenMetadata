#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
function to compute kpi
"""

from __future__ import annotations

import ast
import traceback

from metadata.generated.schema.dataInsight.kpi.basic import KpiResult, KpiTarget
from metadata.generated.schema.dataInsight.type.percentageOfEntitiesWithDescriptionByType import (
    PercentageOfEntitiesWithDescriptionByType,
)
from metadata.generated.schema.dataInsight.type.percentageOfEntitiesWithOwnerByType import (
    PercentageOfEntitiesWithOwnerByType,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.utils.dispatch import enum_register
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


def percentage_of_entities_with_description_kpi_result(
    kpi_target: list[KpiTarget],
    results: list[PercentageOfEntitiesWithDescriptionByType],
    kpi_fqn: FullyQualifiedEntityName,
    timestamp: int,
) -> KpiResult:
    """Validate percentage of entities with description kpi

    Args:
        kpi_target (list[KpiTarget]):
        results (list[PercentageOfEntitiesWithDescriptionByType]):

    Raises:
        ValueError:
        RuntimeError:

    Returns:
        KpiResult:
    """
    if not results:
        raise ValueError("Cannot compute KPI. No results found")

    latest_chart_result = {}

    try:
        total_entity_with_description = sum(
            result.completedDescription for result in results
        )
        total_entity_count = sum(result.entityCount for result in results)
        latest_chart_result["completedDescriptionFraction"] = (
            total_entity_with_description / total_entity_count
        )
    except (TypeError, ZeroDivisionError) as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Could not run KPI result - {exc}")
        raise RuntimeError(exc)

    latest_chart_result["completedDescription"] = total_entity_with_description

    target_results = []

    for target in kpi_target:
        try:
            value = latest_chart_result[target.name]
        except KeyError as exc:
            logger.warning(f"Could not compute KPI result for {target.name} - {exc}")
        else:
            target_results.append(
                KpiTarget(
                    name=target.name,
                    value=value,
                    targetMet=value > ast.literal_eval(target.value),
                )
            )

    return KpiResult(
        timestamp=timestamp,
        targetResult=target_results,
        kpiFqn=kpi_fqn,
    )


def percentage_of_entities_with_owner_kpi_result(
    kpi_target: list[KpiTarget],
    results: list[PercentageOfEntitiesWithOwnerByType],
    kpi_fqn: FullyQualifiedEntityName,
    timestamp: int,
) -> KpiResult:
    """_summary_

    Args:
        kpi_target (list[KpiTarget]): _description_
        data_insight_chart_result (list[PercentageOfEntitiesWithOwnerByType]): _description_

    Raises:
        RuntimeError: _description_

    Returns:
        KpiResult: _description_
    """

    if not results:
        raise ValueError("Cannot compute KPI. No results found")

    latest_chart_result = {}

    try:
        total_entity_with_owner = sum(result.hasOwner for result in results)
        total_entity_count = sum(result.entityCount for result in results)
        latest_chart_result["hasOwnerFraction"] = (
            total_entity_with_owner / total_entity_count
        )
    except (TypeError, ZeroDivisionError) as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Could not run KPI result - {exc}")
        raise RuntimeError(exc)

    latest_chart_result["hasOwner"] = total_entity_with_owner

    target_results = []

    for target in kpi_target:
        try:
            value = latest_chart_result[target.name]
        except KeyError as exc:
            logger.warning(f"Could not compute KPI result for {target.name} - {exc}")
        else:
            target_results.append(
                KpiTarget(
                    name=target.name,
                    value=value,
                    targetMet=value > ast.literal_eval(target.value),
                )
            )

    return KpiResult(
        timestamp=timestamp,
        targetResult=target_results,
        kpiFqn=kpi_fqn,
    )


run_result_registry = enum_register()
run_result_registry.add("PercentageOfEntitiesWithDescriptionByType")(
    percentage_of_entities_with_description_kpi_result
)
run_result_registry.add("PercentageOfEntitiesWithOwnerByType")(
    percentage_of_entities_with_owner_kpi_result
)
