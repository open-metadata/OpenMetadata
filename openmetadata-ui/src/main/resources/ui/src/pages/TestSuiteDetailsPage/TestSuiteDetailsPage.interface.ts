/*
 *  Copyright 2026 Collate.
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

import { NextPreviousProps } from '../../components/common/NextPrevious/NextPrevious.interface';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { TestCase } from '../../generated/tests/testCase';
import { EntityReference, TestSuite } from '../../generated/tests/testSuite';
import { ChangeSummaryEntry } from '../../rest/changeSummaryAPI';
import { ListTestCaseParamsBySearch } from '../../rest/testAPI';
import { ExtraTestCaseDropdownOptions } from '../../utils/TestCaseUtils';

export interface UseTestSuiteDetailsPageResult {
  testSuite: TestSuite | undefined;
  testSuiteDescription: string;
  descriptionChangeSummaryEntry: ChangeSummaryEntry | undefined;
  testOwners: TestSuite['owners'];
  isLoading: boolean;
  isTestCaseLoading: boolean;
  testCaseResult: TestCase[];
  testCaseSearchQuery: string;
  testSuitePermissions: OperationPermission;
  permissions: {
    hasViewPermission?: boolean;
    hasEditPermission?: boolean;
    hasEditOwnerPermission?: boolean;
    hasEditDescriptionPermission?: boolean;
    hasDeletePermission?: boolean;
  };
  extraDropdownContent: ReturnType<typeof ExtraTestCaseDropdownOptions>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isTestCaseModalOpen: boolean;
  setIsTestCaseModalOpen: (open: boolean) => void;
  slashedBreadCrumb: TitleBreadcrumbProps['titleLinks'];
  incidentUrlState: TitleBreadcrumbProps['titleLinks'];
  pagingData: NextPreviousProps;
  showPagination: boolean;
  ingestionPipelineCount: number;
  canAddMultipleDomains: boolean;
  canAddMultipleUserOwners: boolean;
  canAddMultipleTeamOwner: boolean;
  fetchTestCases: (param?: ListTestCaseParamsBySearch) => Promise<void>;
  handleTestCaseSearch: (query: string) => void;
  handleSortTestCase: (apiParams?: ListTestCaseParamsBySearch) => Promise<void>;
  handleAddTestCaseSubmit: (payload: {
    selectAll: boolean;
    includeIds: string[];
    excludeIds: string[];
  }) => Promise<void>;
  onUpdateOwner: (updatedOwners: TestSuite['owners']) => Promise<void>;
  handleDomainUpdate: (
    updateDomain?: EntityReference | EntityReference[]
  ) => Promise<void>;
  onDescriptionUpdate: (updatedHTML: string) => Promise<void>;
  handleDisplayNameChange: (entityName?: EntityName) => Promise<void>;
  handleTestSuiteUpdate: (testCase?: TestCase) => void;
}
