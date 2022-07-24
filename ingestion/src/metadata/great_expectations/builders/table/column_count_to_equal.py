#  Copyright 2022 Collate
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
TestCase builder
"""

from metadata.generated.schema.api.tests.createTableTest import CreateTableTestRequest
from metadata.generated.schema.tests.table import tableColumnCountToEqual
from metadata.generated.schema.tests.tableTest import TableTestType
from metadata.great_expectations.builders.table.base_table_test_builders import (
    BaseTableTestBuilder,
)


class TableColumCountToEqualBuilder(BaseTableTestBuilder):
    """Builder for `expect_table_column_count_to_equal` GE expectation"""

    def _build_test(self) -> CreateTableTestRequest:
        """Specific test builder for the test"""
        return self.build_test_request(
            config=tableColumnCountToEqual.TableColumnCountToEqual(
                columnCount=self.result["expectation_config"]["kwargs"]["value"]
            ),
            test_type=TableTestType.tableColumnCountToEqual,
        )
