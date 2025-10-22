/*
 *  Copyright 2025 Collate.
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
import { uuid } from '../utils/common';

export const DATA_CONTRACT_DETAILS = {
  name: `data_contract_${uuid()}`,
  description: 'new data contract description',
  termsOfService:
    'This is playwright article body here you can add rich text and block, it also support the slash command.',
  displayName: `Data Contract_${uuid()}`,
  description2: 'Modified Data Contract Description',
};

export const DATA_CONTRACT_SEMANTICS1 = {
  name: `data_contract_semantic_1_${uuid()}`,
  description: 'new data contract semantic description 1',
  rules: [
    {
      field: 'Owners',
      operator: 'Is',
    },
    {
      field: 'Description',
      operator: 'Is Set',
    },
  ],
};

export const DATA_CONTRACT_SEMANTICS2 = {
  name: `data_contract_semantic_2_${uuid()}`,
  description: 'new data contract semantic description 2',
  rules: [
    {
      field: 'Display Name',
      operator: 'Is Set',
    },
  ],
};

export const NEW_TABLE_TEST_CASE = {
  name: `table_column_count_to_equal_in_id_${uuid()}`,
  label: 'Table Column Count To Equal',
  type: 'tableColumnCountToEqual',
  value: '1000',
  description: 'New table test case for TableColumnCountToEqual',
};

export const DATA_CONTRACT_CONTAIN_SEMANTICS = {
  name: `data_contract_container_semantic_${uuid()}`,
  description: 'new data contract semantic contains description ',
  rules: [
    {
      field: 'Tier',
      operator: 'Contains',
    },
    {
      field: 'Tags',
      operator: 'Contains',
    },
    {
      field: 'Glossary Term',
      operator: 'Contains',
    },
  ],
};

export const DATA_CONTRACT_NOT_CONTAIN_SEMANTICS = {
  name: `data_contract_container_semantic_${uuid()}`,
  description: 'new data contract semantic contains description ',
  rules: [
    {
      field: 'Tier',
      operator: 'Not Contains',
    },
    {
      field: 'Tags',
      operator: 'Not Contains',
    },
    {
      field: 'Glossary Term',
      operator: 'Not Contains',
    },
  ],
};

export interface DataContractSecuritySlaData {
  consumers: {
    accessPolicyName: string;
    identities: string[];
    row_filters: {
      index: number;
      column_name: string;
      values: string[];
    }[];
  };
  dataClassificationName: string;
  refreshFrequencyIntervalInput: string;
  maxLatencyValueInput: string;
  retentionPeriodInput: string;
  availability: string;
  refreshFrequencyUnitSelect: string;
  maxLatencyUnitSelect: string;
  retentionUnitSelect: string;
  timezone: string;
}

export const DATA_CONTRACT_SECURITY_DETAILS_1: DataContractSecuritySlaData = {
  consumers: {
    accessPolicyName: 'Test Policy Security',
    identities: ['test_1', 'test_2'],
    row_filters: [
      {
        index: 0,
        column_name: 'Column 1',
        values: ['value_1', 'value_2'],
      },
      {
        index: 1,
        column_name: 'Column 2',
        values: ['value_3', 'value_4'],
      },
    ],
  },
  dataClassificationName: 'PII',
  refreshFrequencyIntervalInput: '10',
  maxLatencyValueInput: '20',
  retentionPeriodInput: '30',
  availability: '12:15',
  timezone: 'GMT+09:00 (Asia/Tokyo)',
  refreshFrequencyUnitSelect: 'Day',
  maxLatencyUnitSelect: 'Hour',
  retentionUnitSelect: 'Week',
};

export const DATA_CONTRACT_SECURITY_DETAILS_2: DataContractSecuritySlaData = {
  consumers: {
    accessPolicyName: 'Updated Policy Security',
    identities: ['test_3', 'test_4'],
    row_filters: [
      {
        index: 0,
        column_name: 'Column 3',
        values: ['value_5', 'value_6'],
      },
      {
        index: 1,
        column_name: 'Column 4',
        values: ['value_7', 'value_8'],
      },
    ],
  },
  dataClassificationName: 'PersonalData',
  refreshFrequencyIntervalInput: '50',
  maxLatencyValueInput: '60',
  retentionPeriodInput: '70',
  availability: '05:34',
  timezone: 'GMT+02:00 (Europe/Athens)',
  refreshFrequencyUnitSelect: 'Hour',
  maxLatencyUnitSelect: 'Minute',
  retentionUnitSelect: 'Year',
};

export const DATA_CONTRACT_SECURITY_DETAILS_2_VERIFIED_DETAILS = {
  consumers: {
    accessPolicyName: 'Updated Policy Security',
    identities: ['test_1', 'test_2', 'test_3', 'test_4'],
    row_filters: [
      {
        index: 0,
        column_name: 'Column 3',
        values: ['value_1', 'value_2', 'value_5', 'value_6'],
      },
      {
        index: 1,
        column_name: 'Column 4',
        values: ['value_3', 'value_4', 'value_7', 'value_8'],
      },
    ],
  },
} as DataContractSecuritySlaData;

export const DATA_CONTRACT_SECURITY_CONSUMER_DETAILS = {
  accessPolicyName: 'Test Consumer Security 2',
  identities: ['identity_1', 'identity_2'],
  row_filters: [
    {
      index: 0,
      column_name: 'Consumer_Column_1',
      values: ['column_value_1', 'column_value_2'],
    },
    {
      index: 1,
      column_name: 'Consumer_Column_2',
      values: ['column_value_3', 'column_value_4'],
    },
  ],
};

export const DATA_CONTRACT_SEMANTIC_OPERATIONS = {
  is: 'Is',
  is_not: 'Is Not',
  any_in: 'Any in',
  not_in: 'Not in',
  is_set: 'Is Set',
  is_not_set: 'Is Not Set',
  less: '<',
  greater: '>',
  less_equal: '<=',
  greater_equal: '>=',
  contains: 'Contains',
  not_contains: 'Not contains',
  between: 'Between',
  not_between: 'Not between',
};
