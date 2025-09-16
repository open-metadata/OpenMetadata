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
      field: 'Name',
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

export interface DataContractSecuritySlaData {
  accessPolicyName: string;
  dataClassificationName: string;
  refreshFrequencyIntervalInput: string;
  maxLatencyValueInput: string;
  retentionPeriodInput: string;
  availability: string;
  refreshFrequencyUnitSelect: string;
  maxLatencyUnitSelect: string;
  retentionUnitSelect: string;
}

export const DATA_CONTRACT_SECURITY_DETAILS_1: DataContractSecuritySlaData = {
  accessPolicyName: 'Test Policy Security',
  dataClassificationName: 'PII',
  refreshFrequencyIntervalInput: '10',
  maxLatencyValueInput: '20',
  retentionPeriodInput: '30',
  availability: '12:15 UTC',
  refreshFrequencyUnitSelect: 'Day',
  maxLatencyUnitSelect: 'Hour',
  retentionUnitSelect: 'Week',
};

export const DATA_CONTRACT_SECURITY_DETAILS_2: DataContractSecuritySlaData = {
  accessPolicyName: 'Updated Policy Security',
  dataClassificationName: 'PersonalData',
  refreshFrequencyIntervalInput: '50',
  maxLatencyValueInput: '60',
  retentionPeriodInput: '70',
  availability: '05:34 UTC',
  refreshFrequencyUnitSelect: 'Hour',
  maxLatencyUnitSelect: 'Minute',
  retentionUnitSelect: 'Year',
};
