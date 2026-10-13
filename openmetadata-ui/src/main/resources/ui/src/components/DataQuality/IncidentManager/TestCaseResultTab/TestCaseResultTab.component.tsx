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

import { Box } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';

import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import { ChangeDescription } from '../../../../generated/tests/testCase';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { useEntityRules } from '../../../../hooks/useEntityRules';
import { TestCaseTabProps } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import { getDefaultTestCaseFormVariant } from '../../../../utils/DataQuality/TestCaseFormVariantUtils';
import { getParameterValueDiffRows } from '../../../../utils/EntityVersionUtils';
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
  formatParameterValue,
  getResultTabGridClass,
  hasAdditionalComponents,
  resolveIsSidePanelVisible,
  shouldRenderTestSummary,
  shouldShowAILearningBanner,
  shouldShowEditParameterButton,
} from './TestCaseResultTab.utils';
import TestCaseTestSuitesCard from './TestCaseTestSuitesCard/TestCaseTestSuitesCard';
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
      className="transition-all-200ms tw:min-w-0"
      data-testid="test-case-rail">
      <Box className="tw:w-full" direction="col" gap={4}>
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
            headerVariant="widget"
            showCommentsIcon={false}
            onDescriptionUpdate={handleDescriptionChange}
          />
        </div>
        <div className="tw:w-full">
          <TestCaseTestSuitesCard testSuites={testCaseData?.testSuites} />
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
      </Box>
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
  const isAiMode = useIsAiMode();
  const { entityRules, isRulesLoaded } = useEntityRules(EntityType.TEST_CASE);
  const isSidePanelVisible = resolveIsSidePanelVisible(
    showSidePanel,
    isTabExpanded
  );

  // The version page shows each parameter's change in the card's own rows;
  // only the assertion SQL keeps a diff block of its own.
  const versionDiff = useMemo(
    () =>
      isVersionPage
        ? getParameterValueDiffRows(
            testCaseData?.changeDescription as ChangeDescription,
            testCaseData?.parameterValues
          )
        : undefined,
    [
      isVersionPage,
      testCaseData?.changeDescription,
      testCaseData?.parameterValues,
    ]
  );

  /**
   * A dynamic-assertion test has its bounds learned, so it has no parameter
   * rows of its own — the card renders its callout instead. On the version
   * page the rows are the parameters' diff.
   */
  const parameterRows = useMemo<ConfigurationParameterRow[]>(() => {
    const definitions = new Map(
      testDefinition?.parameterDefinition?.map((definition) => [
        definition.name,
        definition,
      ])
    );
    const labelOf = (name = '') => definitions.get(name)?.displayName ?? name;
    let rows: ConfigurationParameterRow[] = [];

    if (versionDiff) {
      rows = versionDiff.rows.map((row) => ({
        ...row,
        name: row.label,
        label: labelOf(row.label),
      }));
    } else if (!testCaseData?.useDynamicAssertion) {
      rows = withoutSqlParams.map((param) => ({
        name: param.name,
        label: labelOf(param.name),
        value: formatParameterValue(
          param.value,
          definitions.get(param.name)?.dataType
        ),
      }));
    }

    if (showComputeRowCount) {
      rows.push({
        label: t('label.compute-row-count'),
        value: computeRowCountDisplay,
      });
    }

    return rows;
  }, [
    versionDiff,
    withoutSqlParams,
    testCaseData?.useDynamicAssertion,
    showComputeRowCount,
    computeRowCountDisplay,
    testDefinition?.parameterDefinition,
    t,
  ]);

  return (
    <div className="tw:@container">
      <div
        className={classNames(
          // The mock's 22px between the results and the rail.
          'p-md test-case-result-tab tw:grid tw:w-full tw:gap-5.5',
          getResultTabGridClass(isSidePanelVisible)
        )}
        data-testid="test-case-result-tab-container">
        <Box
          className="transition-all-200ms tw:min-w-0 tw:gap-2.5"
          direction="col">
          {shouldShowAILearningBanner(showAILearningBanner, testCaseData) &&
            AlertComponent && (
              <Box direction="col">
                <AlertComponent />
              </Box>
            )}
          {shouldRenderTestSummary(testCaseData, shouldRenderDefaultGraph) && (
            // AI mode sets the result history straight on the page, as the mock
            // does: the tiles carry the only borders in that section.
            <Box
              className={classNames({
                'test-case-result-tab-graph': !isAiMode,
              })}
              data-testid="test-case-result-tab-graph"
              direction="col">
              <TestSummary data={testCaseData} />
            </Box>
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
        </Box>
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
            requireDomainForDataProduct={
              entityRules.requireDomainForDataProduct
            }
            showEditParameterButton={shouldShowEditParameterButton(
              hasEditPermission,
              testCaseData,
              showComputeRowCount,
              Boolean(testCaseData?.dataQualityDimension)
            )}
            testCaseData={testCaseData}
            testDefinition={testDefinition}
            updatedTags={updatedTags}
            versionParameterDiff={versionDiff?.sqlDiff}
            withSqlParams={withSqlParams}
            onEditParameter={() => setIsParameterEdit(true)}
          />
        )}
      </div>
    </div>
  );
};

export default TestCaseResultTab;
