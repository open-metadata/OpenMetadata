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
