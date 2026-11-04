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
import { TestCase } from '../../../../generated/tests/testCase';
import { TestDataType } from '../../../../generated/tests/testDefinition';
import { toFiniteNumber } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import { formatNumber } from '../../../Database/Profiler/TestSummary/TestSummary.utils';

const NUMERIC_PARAMETER_TYPES = new Set<TestDataType | undefined>([
  TestDataType.Decimal,
  TestDataType.Double,
  TestDataType.Float,
  TestDataType.Int,
  TestDataType.Number,
]);

/**
 * A number parameter reads like the page's other numbers, thousands grouped.
 * Only the definition's type says it is a number: a regex or a column name
 * can look like one.
 */
export const formatParameterValue = (
  value: string | undefined,
  dataType: TestDataType | undefined
) => {
  const number = NUMERIC_PARAMETER_TYPES.has(dataType)
    ? toFiniteNumber(value)
    : undefined;

  return isUndefined(number) ? value ?? '' : formatNumber(number);
};

export const shouldShowEditParameterButton = (
  hasEditPermission: boolean | undefined,
  testCaseData: TestCase | undefined,
  showComputeRowCount: boolean,
  // The data quality dimension is edited through this button too, so a test case without
  // parameters of its own still needs it as long as the box shows the dimension.
  hasDataQualityDimension = false
): boolean => {
  const hasEditableContent = [
    testCaseData?.parameterValues?.length,
    testCaseData?.useDynamicAssertion,
    showComputeRowCount,
    hasDataQualityDimension,
  ].some(Boolean);

  return Boolean(hasEditPermission && hasEditableContent);
};

export const shouldShowAILearningBanner = (
  showAILearningBanner: boolean,
  testCaseData: TestCase | undefined
): boolean =>
  Boolean(showAILearningBanner && testCaseData?.useDynamicAssertion);

export const hasAdditionalComponents = (
  additionalComponents: unknown[]
): boolean => !isEmpty(additionalComponents);

/**
 * A type predicate so the caller can pass `testCaseData` straight to
 * `TestSummary`, which requires a defined test case.
 */
export const shouldRenderTestSummary = (
  testCaseData: TestCase | undefined,
  shouldRenderDefaultGraph: boolean
): testCaseData is TestCase =>
  !isUndefined(testCaseData) && shouldRenderDefaultGraph;

export const canEditTestCaseParameters = (
  hasEditPermission: boolean | undefined,
  isParameterEdit: boolean
): boolean => Boolean(hasEditPermission && isParameterEdit);

// The rail keeps the mock's 320 px where the tab has room (30% of it, at least
// 260 px), and stacks under the results below 48rem instead of shrinking to a
// third of the tab, where its rows broke a word per line.
export const getResultTabGridClass = (isSidePanelVisible: boolean): string =>
  isSidePanelVisible
    ? 'tw:grid-cols-1 tw:@3xl:grid-cols-[minmax(0,1fr)_clamp(260px,30%,320px)]'
    : 'tw:grid-cols-1';

export const resolveIsSidePanelVisible = (
  showSidePanel: boolean | undefined,
  isTabExpanded: boolean
): boolean => showSidePanel ?? isTabExpanded;
