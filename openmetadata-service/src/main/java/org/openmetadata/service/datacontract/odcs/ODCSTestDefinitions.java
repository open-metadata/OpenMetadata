/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.datacontract.odcs;

import org.openmetadata.schema.tests.TestCaseParameterValue;

/** Names of the OpenMetadata test definitions and parameters ODCS rules translate to and from. */
final class ODCSTestDefinitions {
  static final String COLUMN_VALUES_TO_BE_NOT_NULL = "columnValuesToBeNotNull";
  static final String COLUMN_VALUES_TO_BE_UNIQUE = "columnValuesToBeUnique";
  static final String COLUMN_VALUES_TO_BE_IN_SET = "columnValuesToBeInSet";
  static final String COLUMN_VALUES_TO_MATCH_REGEX = "columnValuesToMatchRegex";
  static final String COLUMN_VALUES_MISSING_COUNT = "columnValuesMissingCount";
  static final String COLUMN_VALUE_LENGTHS_TO_BE_BETWEEN = "columnValueLengthsToBeBetween";
  static final String COLUMN_VALUES_TO_BE_BETWEEN = "columnValuesToBeBetween";
  static final String TABLE_ROW_COUNT_TO_BE_BETWEEN = "tableRowCountToBeBetween";
  static final String TABLE_ROW_COUNT_TO_EQUAL = "tableRowCountToEqual";
  static final String TABLE_CUSTOM_SQL_QUERY = "tableCustomSQLQuery";

  static final String THRESHOLD = "threshold";
  static final String THRESHOLD_UNIT = "thresholdUnit";
  static final String PERCENTAGE_UNIT = "PERCENTAGE";
  static final String ALLOWED_VALUES = "allowedValues";
  static final String MATCH_ENUM = "matchEnum";
  static final String REGEX = "regex";
  static final String MISSING_COUNT_VALUE = "missingCountValue";
  static final String MISSING_VALUE_MATCH = "missingValueMatch";
  static final String MIN_LENGTH = "minLength";
  static final String MAX_LENGTH = "maxLength";
  static final String MIN_VALUE = "minValue";
  static final String MAX_VALUE = "maxValue";
  static final String VALUE = "value";
  static final String SQL_EXPRESSION = "sqlExpression";
  static final String STRATEGY = "strategy";
  static final String OPERATOR = "operator";
  static final String COUNT_STRATEGY = "COUNT";
  static final String ROWS_STRATEGY = "ROWS";

  static final String EQUAL = "==";
  static final String NOT_EQUAL = "!=";
  static final String GREATER = ">";
  static final String GREATER_OR_EQUAL = ">=";
  static final String LESS = "<";
  static final String LESS_OR_EQUAL = "<=";

  private ODCSTestDefinitions() {}

  static TestCaseParameterValue parameter(String name, String value) {
    return new TestCaseParameterValue().withName(name).withValue(value);
  }
}
