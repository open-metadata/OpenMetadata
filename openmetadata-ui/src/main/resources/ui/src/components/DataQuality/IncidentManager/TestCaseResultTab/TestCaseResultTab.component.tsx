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

import type { SxProps, Theme } from '@mui/material';
import {
  Box,
  Divider,
  Grid,
  Stack,
  SvgIcon,
  Tooltip,
  Typography,
} from '@mui/material';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import chunk from 'lodash/chunk';
import isEmpty from 'lodash/isEmpty';
import isUndefined from 'lodash/isUndefined';
import startCase from 'lodash/startCase';
import toString from 'lodash/toString';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../../enums/codemirror.enum';
import { EntityType } from '../../../../enums/entity.enum';

import { EntityTags } from 'Models';
import { useParams } from 'react-router-dom';
import { ReactComponent as StarIcon } from '../../../../assets/svg/ic-suggestions.svg';
import { EntityField } from '../../../../constants/Feeds.constants';
import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import { Operation } from '../../../../generated/entity/policies/policy';
import {
  ChangeDescription,
  TagLabel,
  TestCaseParameterValue,
} from '../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import {
  getTestDefinitionById,
  updateTestCaseById,
} from '../../../../rest/testAPI';
import {
  getComputeRowCountDiffDisplay,
  getEntityVersionByField,
  getEntityVersionTags,
  getParameterValueDiffDisplay,
} from '../../../../utils/EntityVersionUtils';
import { VersionEntityTypes } from '../../../../utils/EntityVersionUtils.interface';
import { getPrioritizedEditPermission } from '../../../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../../../utils/TableUtils';
import { createTagObject } from '../../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import DescriptionV1 from '../../../common/EntityDescription/DescriptionV1';
import { EditIconButton } from '../../../common/IconButtons/EditIconButton';
import TestSummary from '../../../Database/Profiler/TestSummary/TestSummary';
import SchemaEditor from '../../../Database/SchemaEditor/SchemaEditor';
import TagsContainerV2 from '../../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../../Tag/TagsViewer/TagsViewer.interface';
import EditTestCaseModal from '../../AddDataQualityTest/EditTestCaseModal';
import '../incident-manager.style.less';
import './test-case-result-tab.style.less';
import testCaseResultTabClassBase from './TestCaseResultTabClassBase';

function ParameterTooltipText({
  className,
  title,
  valueSx,
}: {
  className: string;
  title: string;
  valueSx?: SxProps<Theme>;
}) {
  return (
    <Tooltip
      placement="bottom-start"
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: '100%',
          },
        },
      }}
      title={title}>
      <Typography noWrap className={className} sx={valueSx} variant="body2">
        {title}
      </Typography>
    </Tooltip>
  );
}

const TestCaseResultTab = () => {
  const { t } = useTranslation();
  const {
    testCase: testCaseData,
    setTestCase,
    showAILearningBanner,
    testCasePermission,
    isTabExpanded,
  } = useTestCaseStore();
  const { version } = useParams<{ version: string }>();
  const isVersionPage = !isUndefined(version);
  const additionalComponent =
    testCaseResultTabClassBase.getAdditionalComponents(testCaseData);
  const [isParameterEdit, setIsParameterEdit] = useState<boolean>(false);
  const [testDefinition, setTestDefinition] = useState<TestDefinition>();

  const fetchTestDefinition = useCallback(async () => {
    if (testCaseData?.testDefinition?.id) {
      try {
        const definition = await getTestDefinitionById(
          testCaseData.testDefinition.id
        );
        setTestDefinition(definition);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  }, [testCaseData?.testDefinition?.id]);

  useEffect(() => {
    fetchTestDefinition();
  }, [fetchTestDefinition]);

  const showComputeRowCount = useMemo(() => {
    return (
      !isUndefined(testCaseData?.computePassedFailedRowCount) &&
      (testDefinition?.supportsRowLevelPassedFailed ?? false)
    );
  }, [
    testCaseData?.computePassedFailedRowCount,
    testDefinition?.supportsRowLevelPassedFailed,
  ]);

  const {
    hasEditPermission,
    hasEditDescriptionPermission,
    hasEditTagsPermission,
    hasEditGlossaryTermsPermission,
  } = useMemo(() => {
    return isVersionPage
      ? {
          hasEditPermission: false,
          hasEditDescriptionPermission: false,
          hasEditTagsPermission: false,
          hasEditGlossaryTermsPermission: false,
        }
      : {
          hasEditPermission: testCasePermission?.EditAll,
          hasEditDescriptionPermission:
            testCasePermission &&
            getPrioritizedEditPermission(
              testCasePermission,
              Operation.EditDescription
            ),
          hasEditTagsPermission:
            testCasePermission &&
            getPrioritizedEditPermission(
              testCasePermission,
              Operation.EditTags
            ),
          hasEditGlossaryTermsPermission:
            testCasePermission &&
            getPrioritizedEditPermission(
              testCasePermission,
              Operation.EditGlossaryTerms
            ),
        };
  }, [testCasePermission, isVersionPage, getPrioritizedEditPermission]);

  const { withSqlParams, withoutSqlParams } = useMemo(() => {
    const params = testCaseData?.parameterValues ?? [];

    return params.reduce(
      (result, param) => {
        if (param.name === 'sqlExpression') {
          result.withSqlParams.push(param);
        } else {
          result.withoutSqlParams.push(param);
        }

        return result;
      },
      { withSqlParams: [], withoutSqlParams: [] } as {
        withSqlParams: TestCaseParameterValue[];
        withoutSqlParams: TestCaseParameterValue[];
      }
    );
  }, [testCaseData?.parameterValues]);

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    if (!testCaseData) {
      return;
    }
    // Preserve tier tags
    const tierTag = getTierTags(testCaseData.tags ?? []);
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    const updatedTestCase = {
      ...testCaseData,
      tags: [...(tierTag ? [tierTag] : []), ...(updatedTags ?? [])],
    };
    const jsonPatch = compare(testCaseData, updatedTestCase);
    if (jsonPatch.length) {
      try {
        const res = await updateTestCaseById(testCaseData.id ?? '', jsonPatch);
        setTestCase(res);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const handleDescriptionChange = useCallback(
    async (description: string) => {
      if (testCaseData) {
        const updatedTestCase = {
          ...testCaseData,
          description,
        };
        const jsonPatch = compare(testCaseData, updatedTestCase);

        if (jsonPatch.length) {
          try {
            const res = await updateTestCaseById(
              testCaseData.id ?? '',
              jsonPatch
            );
            setTestCase(res);
            showSuccessToast(
              t('server.update-entity-success', {
                entity: t('label.test-case'),
              })
            );
          } catch (error) {
            showErrorToast(error as AxiosError);
          }
        }
      }
    },
    [testCaseData, updateTestCaseById, setTestCase]
  );

  const handleCancelParameter = useCallback(
    () => setIsParameterEdit(false),
    []
  );

  const AlertComponent = useMemo(
    () => testCaseResultTabClassBase.getAlertBanner(),
    []
  );

  const description = useMemo(() => {
    return isVersionPage
      ? getEntityVersionByField(
          testCaseData?.changeDescription as ChangeDescription,
          EntityField.DESCRIPTION,
          testCaseData?.description
        )
      : testCaseData?.description;
  }, [
    testCaseData?.changeDescription,
    testCaseData?.description,
    isVersionPage,
  ]);

  const updatedTags = isVersionPage
    ? getEntityVersionTags(
        testCaseData as VersionEntityTypes,
        testCaseData?.changeDescription as ChangeDescription
      )
    : getTagsWithoutTier(testCaseData?.tags ?? []);

  const computeRowCountDisplay = useMemo(() => {
    if (isVersionPage) {
      return getComputeRowCountDiffDisplay(
        testCaseData?.changeDescription as ChangeDescription,
        testCaseData?.computePassedFailedRowCount
      );
    }

    return toString(testCaseData?.computePassedFailedRowCount);
  }, [
    testCaseData?.changeDescription,
    testCaseData?.computePassedFailedRowCount,
    isVersionPage,
  ]);

  const parameterItems = useMemo(() => {
    const items: Array<{ label: string; value: string | React.ReactNode }> = [];

    if (isVersionPage) {
      // For version page, we'll handle it differently
      return null;
    }

    if (testCaseData?.useDynamicAssertion) {
      items.push({
        label: t('label.dynamic-assertion'),
        value: (
          <label
            className="d-inline-flex items-center gap-2 parameter-value-text"
            data-testid="dynamic-assertion">
            <SvgIcon component={StarIcon} fontSize="small" />{' '}
            {t('label.dynamic-assertion')}
          </label>
        ),
      });
    } else if (!isEmpty(withoutSqlParams)) {
      withoutSqlParams.forEach((param) => {
        items.push({
          label: param.name ?? '',
          value: param.value ?? '',
        });
      });
    }

    // Add compute row count to parameters if it should be shown
    if (showComputeRowCount) {
      items.push({
        label: t('label.compute-row-count'),
        value: computeRowCountDisplay,
      });
    }

    return items.length > 0 ? items : null;
  }, [
    withoutSqlParams,
    testCaseData?.useDynamicAssertion,
    showComputeRowCount,
    computeRowCountDisplay,
    isVersionPage,
  ]);

  const renderParameterRows = useCallback(
    (items: Array<{ label: string; value: string | React.ReactNode }>) => {
      if (items.length === 0) {
        return (
          <Typography color="text.secondary" variant="body2">
            {t('label.no-parameter-available')}
          </Typography>
        );
      }

      // Group items into rows of 2
      const rows = chunk(items, 2);

      return (
        <div className="parameter-rows-container">
          {rows.map((row, rowIndex) => {
            // Create a stable key from the row items' labels
            const rowKey = row.map((item) => item.label).join('-');

            return (
              <div key={rowKey}>
                <Grid container className="parameter-row" spacing={2}>
                  {row.map((item) => (
                    <Grid key={item.label} size={row.length === 1 ? 8 : 6}>
                      <Stack
                        alignItems="flex-start"
                        direction="row"
                        spacing={0.5}
                        sx={{ width: '100%' }}>
                        <ParameterTooltipText
                          className="parameter-label"
                          title={`${item.label}:`}
                        />
                        {typeof item.value === 'string' ? (
                          <ParameterTooltipText
                            className="parameter-value-text"
                            title={item.value}
                            valueSx={{ flex: 1, minWidth: 0 }}
                          />
                        ) : (
                          item.value
                        )}
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
                {rowIndex < rows.length - 1 && (
                  <Divider className="parameter-row-divider" />
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
            <Divider className="parameter-row-divider" />
            {renderParameterRows(computeRowCountItem)}
          </div>
        );
      }

      return versionParams;
    }

    if (!parameterItems || parameterItems.length === 0) {
      return (
        <Typography color="text.secondary" variant="body2">
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
    <Grid
      container
      className="p-md test-case-result-tab"
      data-testid="test-case-result-tab-container"
      spacing={2.5}>
      <Grid className="transition-all-200ms" size={isTabExpanded ? 9 : 12}>
        <Stack spacing={2.5} sx={{ width: '100%' }}>
          <Box sx={{ width: '100%' }}>
            <DescriptionV1
              wrapInCard
              description={description}
              entityType={EntityType.TEST_CASE}
              hasEditAccess={hasEditDescriptionPermission}
              showCommentsIcon={false}
              onDescriptionUpdate={handleDescriptionChange}
            />
          </Box>

          <Box data-testid="parameter-container" sx={{ width: '100%' }}>
            <div className="parameter-container">
              <Stack spacing={1} sx={{ width: '100%' }}>
                <Stack
                  alignItems="center"
                  direction="row"
                  spacing={1}
                  sx={(theme) => ({
                    marginBottom: `${theme.spacing(4)} !important`,
                  })}>
                  <Typography className="parameter-title" variant="body2">
                    {t('label.parameter')}
                  </Typography>
                  {hasEditPermission &&
                    Boolean(
                      testCaseData?.parameterValues?.length ||
                        testCaseData?.useDynamicAssertion ||
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
                </Stack>

                {testCaseParams}
              </Stack>
            </div>
          </Box>

          {!isUndefined(withSqlParams) && !isVersionPage ? (
            <Box sx={{ width: '100%' }}>
              {withSqlParams.map((param) => (
                <div
                  className="sql-expression-container"
                  data-testid="sql-expression-container"
                  key={param.name}>
                  <Stack spacing={1} sx={{ width: '100%' }}>
                    <Stack alignItems="center" direction="row" spacing={1}>
                      <Typography className="parameter-title" variant="body2">
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
                          onClick={() => setIsParameterEdit(true)}
                        />
                      )}
                    </Stack>
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
                  </Stack>
                </div>
              ))}
            </Box>
          ) : null}

          {showAILearningBanner &&
            testCaseData?.useDynamicAssertion &&
            AlertComponent && (
              <Box sx={{ width: '100%' }}>
                <AlertComponent />
              </Box>
            )}
          {testCaseData && (
            <Box className="test-case-result-tab-graph" sx={{ width: '100%' }}>
              <TestSummary data={testCaseData} />
            </Box>
          )}

          {!isEmpty(additionalComponent) &&
            additionalComponent.map(({ Component, id }) => (
              <Component key={id} testCaseData={testCaseData} />
            ))}

          {testCaseData && isParameterEdit && (
            <EditTestCaseModal
              showOnlyParameter
              testCase={testCaseData}
              visible={isParameterEdit}
              onCancel={handleCancelParameter}
              onUpdate={setTestCase}
            />
          )}
        </Stack>
      </Grid>
      {isTabExpanded && (
        <Grid className="transition-all-200ms" size={3}>
          <Stack spacing={2.5} sx={{ width: '100%' }}>
            <Box sx={{ width: '100%' }}>
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
            </Box>
            <Box sx={{ width: '100%' }}>
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
            </Box>
          </Stack>
        </Grid>
      )}
    </Grid>
  );
};

export default TestCaseResultTab;
