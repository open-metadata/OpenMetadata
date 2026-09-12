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

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';

import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import { ChangeDescription } from '../../../../generated/tests/testCase';
import { useEntityRules } from '../../../../hooks/useEntityRules';
import { TestCaseTabProps } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import { getDefaultTestCaseFormVariant } from '../../../../utils/DataQuality/TestCaseFormVariantUtils';
import { getParameterValueDiffDisplay } from '../../../../utils/EntityVersionUtils';
import Description from '../../../common/EntityDescription/Description';
import TestSummary from '../../../Database/Profiler/TestSummary/TestSummary';
import DataProductsContainer from '../../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import TagsContainerV2 from '../../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../../Tag/TagsViewer/TagsViewer.interface';
import TestCaseFormDrawer from '../../AddDataQualityTest/components/TestCaseFormDrawer';
import '../incident-manager.style.less';
import './test-case-result-tab.style.less';
import TestCaseConfigurationCard from './TestCaseConfigurationCard/TestCaseConfigurationCard';
import { ConfigurationParameterRow } from './TestCaseConfigurationCard/TestCaseConfigurationCard.types';
import { TestCaseSidePanelProps } from './TestCaseResultTab.interface';
import {
  canEditTestCaseParameters,
  getSidePanelColSpanClass,
  hasAdditionalComponents,
  resolveIsSidePanelVisible,
  shouldRenderTestSummary,
  shouldShowAILearningBanner,
  shouldShowEditParameterButton,
} from './TestCaseResultTab.utils';
import { useTestCaseResultTab } from './useTestCaseResultTab';

function TestCaseSidePanel({
  testCaseData,
  testDefinition,
  parameterRows,
  withSqlParams,
  versionParameterDiff,
  showEditParameterButton,
  onEditParameter,
  description,
  descriptionChangeSummaryEntry,
  hasEditDescriptionPermission,
  handleDescriptionChange,
  hasEditTagsPermission,
  hasEditGlossaryTermsPermission,
  updatedTags,
  handleTagSelection,
  isVersionPage,
  hasEditPermission,
  isRulesLoaded,
  requireDomainForDataProduct,
  handleDataProductsSave,
}: Readonly<TestCaseSidePanelProps>) {
  return (
    <div
      className="transition-all-200ms tw:col-span-4"
      data-testid="test-case-rail">
      <div className="tw:flex tw:w-full tw:flex-col tw:gap-2.5">
        <div className="tw:w-full">
          <TestCaseConfigurationCard
            isVersionPage={isVersionPage}
            parameterRows={parameterRows}
            showEditButton={showEditParameterButton}
            testCaseData={testCaseData}
            testDefinition={testDefinition}
            versionParameterDiff={versionParameterDiff}
            withSqlParams={withSqlParams}
            onEditParameter={onEditParameter}
          />
        </div>
        <div className="tw:w-full">
          <Description
            wrapInCard
            changeSummaryEntry={descriptionChangeSummaryEntry}
            description={description}
            entityType={EntityType.TEST_CASE}
            hasEditAccess={hasEditDescriptionPermission}
            showCommentsIcon={false}
            onDescriptionUpdate={handleDescriptionChange}
          />
        </div>
        <div className="tw:w-full">
          <TagsContainerV2
            newLook
            displayType={DisplayType.READ_MORE}
            entityFqn={testCaseData?.fullyQualifiedName}
            entityType={EntityType.TEST_CASE}
            permission={hasEditTagsPermission ?? false}
            selectedTags={updatedTags ?? []}
            showTaskHandler={false}
            tagType={TagSource.Classification}
            onSelectionChange={handleTagSelection}
          />
        </div>
        <div className="tw:w-full">
          <TagsContainerV2
            newLook
            displayType={DisplayType.READ_MORE}
            entityFqn={testCaseData?.fullyQualifiedName}
            entityType={EntityType.TEST_CASE}
            permission={hasEditGlossaryTermsPermission ?? false}
            selectedTags={updatedTags ?? []}
            showTaskHandler={false}
            tagType={TagSource.Glossary}
            onSelectionChange={handleTagSelection}
          />
        </div>
        <div className="tw:w-full">
          <DataProductsContainer
            multiple
            newLook
            activeDomains={testCaseData?.domains ?? []}
            dataProducts={testCaseData?.dataProducts ?? []}
            hasPermission={!isVersionPage && (hasEditPermission ?? false)}
            requireDomainForDataProduct={
              !isRulesLoaded || requireDomainForDataProduct
            }
            onSave={handleDataProductsSave}
          />
        </div>
      </div>
    </div>
  );
}

const TestCaseResultTab = ({
  showSidePanel,
  editVariant = getDefaultTestCaseFormVariant(),
}: TestCaseTabProps) => {
  const { t } = useTranslation();
  const {
    testCase: testCaseData,
    setTestCase,
    isVersionPage,
    testDefinition,
    showComputeRowCount,
    computeRowCountDisplay,
    hasEditPermission,
    hasEditDescriptionPermission,
    hasEditTagsPermission,
    hasEditGlossaryTermsPermission,
    withSqlParams,
    withoutSqlParams,
    description,
    descriptionChangeSummaryEntry,
    updatedTags,
    handleTagSelection,
    handleDataProductsSave,
    handleDescriptionChange,
    isParameterEdit,
    setIsParameterEdit,
    handleCancelParameter,
    showAILearningBanner,
    isTabExpanded,
    AlertComponent,
    additionalComponents,
    shouldRenderDefaultGraph,
  } = useTestCaseResultTab();
  const { entityRules, isRulesLoaded } = useEntityRules(EntityType.TEST_CASE);
  const isSidePanelVisible = resolveIsSidePanelVisible(
    showSidePanel,
    isTabExpanded
  );

  /**
   * A dynamic-assertion test has its bounds learned, so it has no parameter
   * rows of its own — the card renders its callout instead. The version page's
   * parameters arrive as a pre-rendered diff, so only the compute-row-count
   * row is passed through here.
   */
  const parameterRows = useMemo<ConfigurationParameterRow[]>(() => {
    const rows: ConfigurationParameterRow[] =
      isVersionPage || testCaseData?.useDynamicAssertion
        ? []
        : withoutSqlParams.map((param) => ({
            label: param.name ?? '',
            value: param.value ?? '',
          }));

    if (showComputeRowCount) {
      rows.push({
        label: t('label.compute-row-count'),
        value: computeRowCountDisplay,
      });
    }

    return rows;
  }, [
    withoutSqlParams,
    isVersionPage,
    testCaseData?.useDynamicAssertion,
    showComputeRowCount,
    computeRowCountDisplay,
    t,
  ]);

  const versionParameterDiff = useMemo(() => {
    if (!isVersionPage) {
      return undefined;
    }

    return getParameterValueDiffDisplay(
      testCaseData?.changeDescription as ChangeDescription,
      testCaseData?.parameterValues
    );
  }, [
    isVersionPage,
    testCaseData?.changeDescription,
    testCaseData?.parameterValues,
  ]);

  return (
    <div
      className="p-md test-case-result-tab tw:grid tw:w-full tw:grid-cols-12 tw:gap-2.5"
      data-testid="test-case-result-tab-container">
      <div
        className={`transition-all-200ms ${getSidePanelColSpanClass(
          isSidePanelVisible
        )}`}>
        <div className="tw:flex tw:w-full tw:flex-col tw:gap-2.5">
          {shouldShowAILearningBanner(showAILearningBanner, testCaseData) &&
            AlertComponent && (
              <div className="tw:w-full">
                <AlertComponent />
              </div>
            )}
          {shouldRenderTestSummary(testCaseData, shouldRenderDefaultGraph) && (
            <div className="test-case-result-tab-graph tw:w-full">
              <TestSummary data={testCaseData} />
            </div>
          )}

          {hasAdditionalComponents(additionalComponents) &&
            additionalComponents.map(({ Component, id }) => (
              <Component key={id} testCaseData={testCaseData} />
            ))}

          {testCaseData &&
            canEditTestCaseParameters(hasEditPermission, isParameterEdit) && (
              <TestCaseFormDrawer
                showOnlyParameter
                open={isParameterEdit}
                showDocPanel={false}
                testCase={testCaseData}
                variant={editVariant}
                onClose={handleCancelParameter}
                onUpdate={setTestCase}
              />
            )}
        </div>
      </div>
      {isSidePanelVisible && (
        <TestCaseSidePanel
          description={description}
          descriptionChangeSummaryEntry={descriptionChangeSummaryEntry}
          handleDataProductsSave={handleDataProductsSave}
          handleDescriptionChange={handleDescriptionChange}
          handleTagSelection={handleTagSelection}
          hasEditDescriptionPermission={hasEditDescriptionPermission}
          hasEditGlossaryTermsPermission={hasEditGlossaryTermsPermission}
          hasEditPermission={hasEditPermission}
          hasEditTagsPermission={hasEditTagsPermission}
          isRulesLoaded={isRulesLoaded}
          isVersionPage={isVersionPage}
          parameterRows={parameterRows}
          requireDomainForDataProduct={entityRules.requireDomainForDataProduct}
          showEditParameterButton={shouldShowEditParameterButton(
            hasEditPermission,
            testCaseData,
            showComputeRowCount
          )}
          testCaseData={testCaseData}
          testDefinition={testDefinition}
          updatedTags={updatedTags}
          versionParameterDiff={versionParameterDiff}
          withSqlParams={withSqlParams}
          onEditParameter={() => setIsParameterEdit(true)}
        />
      )}
    </div>
  );
};

export default TestCaseResultTab;
