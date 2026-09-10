/*
 *  Copyright 2023 Collate.
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

import { EntityTags } from 'Models';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import {
  TagLabel,
  TestCase,
  TestCaseParameterValue,
} from '../../../../generated/tests/testCase';

export interface SqlParamsSectionProps {
  withSqlParams: TestCaseParameterValue[];
  hasEditPermission: boolean | undefined;
  onEditParameter: () => void;
}

export interface TestCaseSidePanelProps {
  testCaseData: TestCase | undefined;
  hasEditTagsPermission: boolean | undefined;
  hasEditGlossaryTermsPermission: boolean | undefined;
  updatedTags: TagLabel[];
  handleTagSelection: (selectedTags: EntityTags[]) => Promise<void>;
  isVersionPage: boolean;
  hasEditPermission: boolean | undefined;
  isRulesLoaded: boolean;
  requireDomainForDataProduct: boolean | undefined;
  handleDataProductsSave: (dataProducts: DataProduct[]) => Promise<void>;
}
