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
Type aliases for classifiable entities

Entities in this alias must have the following attributes:
- fullyQualifiedName: FullyQualifiedEntityName
- id: entity ID
- columns: List[Column]

Currently: Table only
Future expansion example:
    from typing import Union
    from metadata.generated.schema.entity.data.container import Container
    from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel

    ClassifiableEntityType = Union[Table, Container, DashboardDataModel]
"""
from metadata.generated.schema.entity.data.table import Table

ClassifiableEntityType = Table
