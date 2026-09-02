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

import { Typography } from '@openmetadata/ui-core-components';
import { Tooltip } from 'antd';
import chunk from 'lodash/chunk';
import isEmpty from 'lodash/isEmpty';
import isUndefined from 'lodash/isUndefined';
import startCase from 'lodash/startCase';
import { EntityTags } from 'Models';
import React, { lazy, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../../enums/codemirror.enum';
import { EntityType } from '../../../../enums/entity.enum';

import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import {
  ChangeDescription,
  TagLabel,
  TestCase,
  TestCaseParameterValue,
} from '../../../../generated/tests/testCase';
import { useEntityRules } from '../../../../hooks/useEntityRules';
import { TestCaseTabProps } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import { getDefaultTestCaseFormVariant } from '../../../../utils/DataQuality/TestCaseFormVariantUtils';
import { getParameterValueDiffDisplay } from '../../../../utils/EntityVersionUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import Description from '../../../common/EntityDescription/Description';
import { EditIconButton } from '../../../common/IconButtons/EditIconButton';
import TestSummary from '../../../Database/Profiler/TestSummary/TestSummary';
import DataProductsContainer from '../../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import TagsContainerV2 from '../../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../../Tag/TagsViewer/TagsViewer.interface';
import TestCaseFormDrawer from '../../AddDataQualityTest/components/TestCaseFormDrawer';
import '../incident-manager.style.less';
import './test-case-result-tab.style.less';
import {
  ParameterDisplayItem,
  useTestCaseResultTab,
} from './useTestCaseResultTab';
const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../../Database/SchemaEditor/SchemaEditor'))
);

function ParameterTooltipText({
  className,
  title,
}: Readonly<{
  className: string;
  title: string;
}>) {
  return (
    <Tooltip
      overlayClassName="test-case-result-tooltip"
      placement="bottomLeft"
      showArrow={false}
      title={title}>
      <span className={className}>{title}</span>
    </Tooltip>
  );
}

const shouldShowEditParameterButton = (
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

const shouldShowAILearningBanner = (
  showAILearningBanner: boolean,
  testCaseData: TestCase | undefined
): boolean =>
  Boolean(showAILearningBanner && testCaseData?.useDynamicAssertion);

const shouldShowSqlParamsSection = (
  withSqlParams: TestCaseParameterValue[] | undefined,
  isVersionPage: boolean
): boolean => !isUndefined(withSqlParams) && !isVersionPage;

const hasAdditionalComponents = (additionalComponents: unknown[]): boolean =>
  !isEmpty(additionalComponents);

const canEditTestCaseParameters = (
  hasEditPermission: boolean | undefined,
  isParameterEdit: boolean
): boolean => Boolean(hasEditPermission && isParameterEdit);

const getSidePanelColSpanClass = (isSidePanelVisible: boolean): string =>
  isSidePanelVisible ? 'tw:col-span-9' : 'tw:col-span-12';

const resolveIsSidePanelVisible = (
  showSidePanel: boolean | undefined,
  isTabExpanded: boolean
): boolean => showSidePanel ?? isTabExpanded;

interface SqlParamsSectionProps {
  withSqlParams: TestCaseParameterValue[];
  hasEditPermission: boolean | undefined;
  onEditParameter: () => void;
}

function SqlParamsSection({
  withSqlParams,
  hasEditPermission,
  onEditParameter,
}: Readonly<SqlParamsSectionProps>) {
  const { t } = useTranslation();

  return (
    <div className="tw:w-full">
      {withSqlParams.map((param) => (
        <div
          className="sql-expression-container"
          data-testid="sql-expression-container"
          key={param.name}>
          <div className="tw:flex tw:w-full tw:flex-col tw:gap-1">
            <div className="tw:flex tw:flex-row tw:items-center tw:gap-1">
              <Typography as="span" className="parameter-title tw:text-body">
                {startCase(param.name)}
              </Typography>
              {hasEditPermission && (
                <EditIconButton
                  newLook
                  data-testid="edit-sql-param-icon"
                  size="small"
                  title={t('label.edit-entity', {
                    entity: t('label.parameter'),
                  })}
                  onClick={onEditParameter}
                />
              )}
            </div>
            <SchemaEditor
              className="custom-code-mirror-theme query-editor-min-h-60"
              editorClass="table-query-editor"
              mode={{ name: CSMode.SQL }}
              options={{
                styleActiveLine: false,
                readOnly: true,
              }}
              value={param.value ?? ''}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface TestCaseSidePanelProps {
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

function TestCaseSidePanel({
  testCaseData,
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
    <div className="transition-all-200ms tw:col-span-3">
      <div className="tw:flex tw:w-full tw:flex-col tw:gap-2.5">
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
    showComputeRowCount,
    computeRowCountDisplay,
    hasEditPermission,
    hasEditDescriptionPermission,
    hasEditTagsPermission,
    hasEditGlossaryTermsPermission,
    withSqlParams,
    parameterItems,
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
  } = useTestCaseResultTab();
  const { entityRules, isRulesLoaded } = useEntityRules(EntityType.TEST_CASE);
  const isSidePanelVisible = resolveIsSidePanelVisible(
    showSidePanel,
    isTabExpanded
  );

  const renderParameterRows = useCallback(
    (items: ParameterDisplayItem[]) => {
      if (items.length === 0) {
        return (
          <Typography as="span" className="tw:text-body tw:text-tertiary">
            {t('label.no-parameter-available')}
          </Typography>
        );
      }

      const rows = chunk(items, 2);

      return (
        <div className="parameter-rows-container">
          {rows.map((row, rowIndex) => {
            // Create a stable key from the row items' labels
            const rowKey = row.map((item) => item.label ?? '').join('-');

            return (
              <div key={rowKey}>
                <div className="parameter-row">
                  {row.map((item) => (
                    <div
                      className={
                        row.length === 1
                          ? 'parameter-row-cell parameter-row-cell--full'
                          : 'parameter-row-cell parameter-row-cell--half'
                      }
                      key={item.label ?? ''}>
                      <div className="parameter-row-cell-content">
                        {item.label && (
                          <ParameterTooltipText
                            className="parameter-label"
                            title={`${item.label}:`}
                          />
                        )}
                        {typeof item.value === 'string' ? (
                          <ParameterTooltipText
                            className="parameter-value-text parameter-value-text-flex"
                            title={item.value}
                          />
                        ) : (
                          item.value
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {rowIndex < rows.length - 1 && (
                  <div aria-hidden className="parameter-row-divider" />
                )}
              </div>
            );
          })}
        </div>
      );
    },
    [t]
  );

  const testCaseParams = useMemo(() => {
    if (isVersionPage) {
      // For version page, get the diff display and add compute row count
      const versionParams = getParameterValueDiffDisplay(
        testCaseData?.changeDescription as ChangeDescription,
        testCaseData?.parameterValues
      );

      // Add compute row count to version page if it should be shown
      if (showComputeRowCount) {
        const computeRowCountItem: Array<{
          label: string;
          value: string | React.ReactNode;
        }> = [
          {
            label: t('label.compute-row-count'),
            value: computeRowCountDisplay,
          },
        ];

        return (
          <div>
            {versionParams}
            <div aria-hidden className="parameter-row-divider" />
            {renderParameterRows(computeRowCountItem)}
          </div>
        );
      }

      return versionParams;
    }

    if (!parameterItems || parameterItems.length === 0) {
      return (
        <Typography as="span" className="tw:text-body tw:text-tertiary">
          {t('label.no-parameter-available')}
        </Typography>
      );
    }

    return renderParameterRows(parameterItems);
  }, [
    parameterItems,
    testCaseData?.changeDescription,
    testCaseData?.parameterValues,
    isVersionPage,
    showComputeRowCount,
    computeRowCountDisplay,
    renderParameterRows,
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

          <div className="tw:w-full" data-testid="parameter-container">
            <div className="parameter-container">
              <div className="tw:flex tw:w-full tw:flex-col tw:gap-1">
                <div className="tw:mb-4 tw:flex tw:flex-row tw:items-center tw:gap-1">
                  <Typography
                    as="span"
                    className="parameter-title tw:text-body">
                    {t('label.parameter')}
                  </Typography>
                  {shouldShowEditParameterButton(
                    hasEditPermission,
                    testCaseData,
                    showComputeRowCount
                  ) && (
                    <EditIconButton
                      newLook
                      data-testid="edit-parameter-icon"
                      size="small"
                      title={t('label.edit-entity', {
                        entity: t('label.parameter'),
                      })}
                      onClick={() => setIsParameterEdit(true)}
                    />
                  )}
                </div>

                {testCaseParams}
              </div>
            </div>
          </div>

          {shouldShowSqlParamsSection(withSqlParams, isVersionPage) ? (
            <SqlParamsSection
              hasEditPermission={hasEditPermission}
              withSqlParams={withSqlParams}
              onEditParameter={() => setIsParameterEdit(true)}
            />
          ) : null}

          {shouldShowAILearningBanner(showAILearningBanner, testCaseData) &&
            AlertComponent && (
              <div className="tw:w-full">
                <AlertComponent />
              </div>
            )}
          {testCaseData && (
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
          handleDataProductsSave={handleDataProductsSave}
          handleTagSelection={handleTagSelection}
          hasEditGlossaryTermsPermission={hasEditGlossaryTermsPermission}
          hasEditPermission={hasEditPermission}
          hasEditTagsPermission={hasEditTagsPermission}
          isRulesLoaded={isRulesLoaded}
          isVersionPage={isVersionPage}
          requireDomainForDataProduct={entityRules.requireDomainForDataProduct}
          testCaseData={testCaseData}
          updatedTags={updatedTags}
        />
      )}
    </div>
  );
};

export default TestCaseResultTab;
