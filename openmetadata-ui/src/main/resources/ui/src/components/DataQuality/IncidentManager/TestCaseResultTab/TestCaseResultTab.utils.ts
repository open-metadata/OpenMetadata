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

import isEmpty from 'lodash/isEmpty';
import isUndefined from 'lodash/isUndefined';
import {
  TestCase,
  TestCaseParameterValue,
} from '../../../../generated/tests/testCase';

export const shouldShowEditParameterButton = (
  hasEditPermission: boolean | undefined,
  testCaseData: TestCase | undefined,
  showComputeRowCount: boolean
): boolean =>
  Boolean(
    hasEditPermission &&
      (testCaseData?.parameterValues?.length ||
        testCaseData?.useDynamicAssertion ||
        showComputeRowCount)
  );

export const shouldShowAILearningBanner = (
  showAILearningBanner: boolean,
  testCaseData: TestCase | undefined
): boolean =>
  Boolean(showAILearningBanner && testCaseData?.useDynamicAssertion);

export const shouldShowSqlParamsSection = (
  withSqlParams: TestCaseParameterValue[] | undefined,
  isVersionPage: boolean
): boolean => !isUndefined(withSqlParams) && !isVersionPage;

export const hasAdditionalComponents = (
  additionalComponents: unknown[]
): boolean => !isEmpty(additionalComponents);

export const canEditTestCaseParameters = (
  hasEditPermission: boolean | undefined,
  isParameterEdit: boolean
): boolean => Boolean(hasEditPermission && isParameterEdit);

export const getSidePanelColSpanClass = (isSidePanelVisible: boolean): string =>
  isSidePanelVisible ? 'tw:col-span-9' : 'tw:col-span-12';

export const resolveIsSidePanelVisible = (
  showSidePanel: boolean | undefined,
  isTabExpanded: boolean
): boolean => showSidePanel ?? isTabExpanded;
