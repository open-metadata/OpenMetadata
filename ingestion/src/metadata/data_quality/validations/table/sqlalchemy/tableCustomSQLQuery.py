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
Validator for table custom SQL Query test case
"""

from sqlalchemy import text

from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.data_quality.validations.table.base.tableCustomSQLQuery import (
    BaseTableCustomSQLQueryValidator,
    Strategy,
)
from metadata.utils.helpers import is_safe_sql_query


class TableCustomSQLQueryValidator(BaseTableCustomSQLQueryValidator, SQAValidatorMixin):
    """Validator for table custom SQL Query test case"""

    def _run_results(self, sql_expression: str, strategy: Strategy = Strategy.ROWS):
        """compute result of the test case"""
        if not is_safe_sql_query(sql_expression):
            raise RuntimeError(f"SQL expression is not safe\n\n{sql_expression}")
        try:
            cursor = self.runner._session.execute(  # pylint: disable=protected-access
                text(sql_expression)
            )
            if strategy == Strategy.COUNT:
                result = cursor.scalar()
                if not isinstance(result, int):
                    raise ValueError(
                        f"When using COUNT strategy, the result must be an integer. Received: {type(result)}\n"
                        "Example: SELECT COUNT(*) FROM table_name WHERE my_value IS NOT NULL"
                    )
                return result
            return cursor.fetchall()
        except Exception as exc:
            self.runner._session.rollback()  # pylint: disable=protected-access
            raise exc
