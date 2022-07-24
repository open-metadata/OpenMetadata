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
TestCase builder for table column count
"""

from metadata.generated.schema.api.tests.createTableTest import CreateTableTestRequest
from metadata.generated.schema.tests.table import tableColumnNameToExist
from metadata.generated.schema.tests.tableTest import TableTestType
from metadata.great_expectations.builders.table.base_table_test_builders import (
    BaseTableTestBuilder,
)


class TableColumnNameToExistBuilder(BaseTableTestBuilder):
    """Builder for `expect_table_row_count_to_be_between` GE expectation"""

    def _build_test(self) -> CreateTableTestRequest:
        """Specific test builder for the test"""
        return self.build_test_request(
            config=tableColumnNameToExist.TableColumnNameToExist(
                columnName=self.result["expectation_config"]["kwargs"]["column"],
            ),
            test_type=TableTestType.tableColumnNameToExist,
        )
