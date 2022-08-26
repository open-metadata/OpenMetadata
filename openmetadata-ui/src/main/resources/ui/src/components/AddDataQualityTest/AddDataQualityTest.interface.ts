/*
 *  Copyright 2022 Collate
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

import { Table } from '../../generated/entity/data/table';
import { EntityReference } from '../../generated/tests/tableTest';

export interface AddDataQualityTestProps {
  table: Table;
}

export interface SelectTestSuiteProps {
  onSubmit: (data: SelectTestSuiteType) => void;
}

export type SelectTestSuiteType = {
  name?: string;
  description?: string;
  data?: EntityReference;
  isNewTestSuite: boolean;
};
