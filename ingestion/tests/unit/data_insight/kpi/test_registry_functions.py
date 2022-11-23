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


from metadata.data_insight.runner.run_result_registry import (
    percentage_of_entities_with_description_kpi_result,
    percentage_of_entities_with_owner_kpi_result,
)
from metadata.generated.schema.dataInsight.kpi.basic import KpiTarget
from metadata.generated.schema.dataInsight.type.percentageOfEntitiesWithDescriptionByType import (
    PercentageOfEntitiesWithDescriptionByType,
)
from metadata.generated.schema.dataInsight.type.percentageOfEntitiesWithOwnerByType import (
    PercentageOfEntitiesWithOwnerByType,
)
from metadata.generated.schema.type.basic import Timestamp


def test_percentage_of_entities_with_description_kpi_result():
    """test regustry function"""
    kpi_target = [
        KpiTarget(name="completedDescriptionFraction", value="0.55", targetMet=None),
        KpiTarget(name="completedDescription", value="63", targetMet=None),
    ]

    results = [
        PercentageOfEntitiesWithDescriptionByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="User",
            completedDescriptionFraction=0.0,
            completedDescription=0.0,
            entityCount=11.0,
        ),
        PercentageOfEntitiesWithDescriptionByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Chart",
            completedDescriptionFraction=1.0,
            completedDescription=12.0,
            entityCount=12.0,
        ),
        PercentageOfEntitiesWithDescriptionByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Dashboard",
            completedDescriptionFraction=1.0,
            completedDescription=12.0,
            entityCount=12.0,
        ),
        PercentageOfEntitiesWithDescriptionByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Database",
            completedDescriptionFraction=1.0,
            completedDescription=1.0,
            entityCount=1.0,
        ),
        PercentageOfEntitiesWithDescriptionByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="DatabaseSchema",
            completedDescriptionFraction=1.0,
            completedDescription=1.0,
            entityCount=1.0,
        ),
        PercentageOfEntitiesWithDescriptionByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="MlModel",
            completedDescriptionFraction=1.0,
            completedDescription=3.0,
            entityCount=3.0,
        ),
        PercentageOfEntitiesWithDescriptionByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Pipeline",
            completedDescriptionFraction=1.0,
            completedDescription=8.0,
            entityCount=8.0,
        ),
        PercentageOfEntitiesWithDescriptionByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Table",
            completedDescriptionFraction=0.6111111111111112,
            completedDescription=11.0,
            entityCount=18.0,
        ),
        PercentageOfEntitiesWithDescriptionByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="TestSuite",
            completedDescriptionFraction=1.0,
            completedDescription=3.0,
            entityCount=3.0,
        ),
        PercentageOfEntitiesWithDescriptionByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Topic",
            completedDescriptionFraction=1.0,
            completedDescription=6.0,
            entityCount=6.0,
        ),
    ]

    kpi_result = percentage_of_entities_with_description_kpi_result(
        kpi_target, results, "completedDescription", 1668083253659
    )

    assert kpi_result.targetResult
    for result in kpi_result.targetResult:
        if result.name == "completedDescriptionFraction":
            assert result.value == "0.76"
            assert result.targetMet is True
        if result.name == "completedDescription":
            assert result.value == "57.0"
            assert result.targetMet is False


def test_percentage_of_entities_with_owner_kpi_result():
    """test regustry function"""
    kpi_target = [
        KpiTarget(name="hasOwnerFraction", value="0.46", targetMet=None),
        KpiTarget(name="hasOwner", value="63", targetMet=None),
    ]

    results = [
        PercentageOfEntitiesWithOwnerByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="User",
            hasOwnerFraction=1.0,
            hasOwner=12.0,
            entityCount=12.0,
        ),
        PercentageOfEntitiesWithOwnerByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Chart",
            hasOwnerFraction=0.0,
            hasOwner=0.0,
            entityCount=12.0,
        ),
        PercentageOfEntitiesWithOwnerByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Dashboard",
            hasOwnerFraction=1.0,
            hasOwner=12.0,
            entityCount=12.0,
        ),
        PercentageOfEntitiesWithOwnerByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Database",
            hasOwnerFraction=0.0,
            hasOwner=0.0,
            entityCount=1.0,
        ),
        PercentageOfEntitiesWithOwnerByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="DatabaseSchema",
            hasOwnerFraction=1.0,
            hasOwner=1.0,
            entityCount=1.0,
        ),
        PercentageOfEntitiesWithOwnerByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="MlModel",
            hasOwnerFraction=0.0,
            hasOwner=0.0,
            entityCount=3.0,
        ),
        PercentageOfEntitiesWithOwnerByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Pipeline",
            hasOwnerFraction=0.0,
            hasOwner=0.0,
            entityCount=8.0,
        ),
        PercentageOfEntitiesWithOwnerByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Table",
            hasOwnerFraction=1.0,
            hasOwner=10.0,
            entityCount=18.0,
        ),
        PercentageOfEntitiesWithOwnerByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="TestSuite",
            hasOwnerFraction=0.0,
            hasOwner=0.0,
            entityCount=3.0,
        ),
        PercentageOfEntitiesWithOwnerByType(
            timestamp=Timestamp(__root__=1668038400000),
            entityType="Topic",
            hasOwnerFraction=0.0,
            hasOwner=0.0,
            entityCount=6.0,
        ),
    ]

    kpi_result = percentage_of_entities_with_owner_kpi_result(
        kpi_target, results, "completedOwner", 1668083253659
    )

    assert kpi_result.targetResult
    for result in kpi_result.targetResult:
        if result.name == "hasOwnerFraction":
            assert result.value == "0.4605263157894737"
            assert result.targetMet is True
        if result.name == "completedDescription":
            assert result.value == "35.0"
            assert result.targetMet is False
