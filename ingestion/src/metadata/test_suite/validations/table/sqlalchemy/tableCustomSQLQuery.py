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
# pylint: disable=invalid-name

"""
Validator for column value length to be between test case
"""

from metadata.test_suite.validations.mixins.sqa_validator_mixin import \
    SQAValidatorMixin
from metadata.test_suite.validations.table.base.tableCustomSQLQuery import BaseTableCustomSQLQueryValidator
from sqlalchemy import text


class TableCustomSQLQueryValidator(BaseTableCustomSQLQueryValidator, SQAValidatorMixin):
    """ "Validator for column value mean to be between test case"""

    def _run_results(self, sql_expression):
        """compute result of the test case"""
        return self.runner._session.execute(  # pylint: disable=protected-access
                text(sql_expression)
            ).all()