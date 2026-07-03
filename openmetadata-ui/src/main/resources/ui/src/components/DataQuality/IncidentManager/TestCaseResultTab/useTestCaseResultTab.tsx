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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import isEmpty from 'lodash/isEmpty';
import isUndefined from 'lodash/isUndefined';
import toString from 'lodash/toString';
import { EntityTags } from 'Models';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ReactComponent as StarIcon } from '../../../../assets/svg/ic-suggestions.svg';
import { EntityField } from '../../../../constants/Feeds.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { Operation } from '../../../../generated/entity/policies/policy';
import {
  ChangeDescription,
  TagLabel,
  TestCase,
  TestCaseParameterValue,
} from '../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import { useChangeSummary } from '../../../../hooks/useChangeSummary';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import { ChangeSummaryEntry } from '../../../../rest/changeSummaryAPI';
import {
  getTestDefinitionById,
  updateTestCaseById,
} from '../../../../rest/testAPI';
import { getComputeRowCountDiffDisplay } from '../../../../utils/EntityVersionUtils';
import { VersionEntityTypes } from '../../../../utils/EntityVersionUtils.interface';
import {
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../../utils/EntityVersionUtilsPure';
import { getPrioritizedEditPermission } from '../../../../utils/PermissionsUtils';
import {
  getTagsWithoutTier,
  getTierTags,
} from '../../../../utils/TablePureUtils';
import { createTagObject } from '../../../../utils/TagsPureUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import testCaseResultTabClassBase, {
  AdditionalComponentInterface,
} from './TestCaseResultTabClassBase';

export interface ParameterDisplayItem {
  label?: string;
  value: string | React.ReactNode;
}

export interface UseTestCaseResultTabResult {
  testCase: TestCase | undefined;
  setTestCase: (testCase: TestCase) => void;
  isVersionPage: boolean;
  testDefinition: TestDefinition | undefined;
  showComputeRowCount: boolean;
  computeRowCountDisplay: string | React.ReactNode;
  hasEditPermission: boolean | undefined;
  hasEditDescriptionPermission: boolean | undefined;
  hasEditTagsPermission: boolean | undefined;
  hasEditGlossaryTermsPermission: boolean | undefined;
  withSqlParams: TestCaseParameterValue[];
  withoutSqlParams: TestCaseParameterValue[];
  parameterItems: ParameterDisplayItem[] | null;
  description: string | undefined;
  descriptionChangeSummaryEntry: ChangeSummaryEntry | undefined;
  updatedTags: TagLabel[];
  handleTagSelection: (selectedTags: EntityTags[]) => Promise<void>;
  handleDataProductsSave: (dataProducts: DataProduct[]) => Promise<void>;
  handleDescriptionChange: (description: string) => Promise<void>;
  isParameterEdit: boolean;
  setIsParameterEdit: (isParameterEdit: boolean) => void;
  handleCancelParameter: () => void;
  showAILearningBanner: boolean;
  isTabExpanded: boolean;
  AlertComponent: FC | null;
  additionalComponents: AdditionalComponentInterface[];
}

/**
 * Data + handlers for the test-case results tab: test-definition fetch,
 * permission flags, parameter splitting, version-aware description/tags/
 * parameter values, and the description/tags/data-products patch handlers.
 * Shared by the OSS antd renderer (TestCaseResultTab) and the AskCollate AI
 * renderer — layout chrome stays in each renderer.
 */
export const useTestCaseResultTab = (): UseTestCaseResultTabResult => {
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
  const [isParameterEdit, setIsParameterEdit] = useState<boolean>(false);
  const [testDefinition, setTestDefinition] = useState<TestDefinition>();

  const additionalComponents =
    testCaseResultTabClassBase.getAdditionalComponents(testCaseData);

  // The test-case page mounts no GenericProvider, so the description
  // attribution must be fetched directly instead of read from context.
  const { changeSummary, refetch: refetchChangeSummary } = useChangeSummary(
    EntityType.TEST_CASE,
    testCaseData?.id ?? '',
    { limit: 1000 }
  );

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

  const handleDataProductsSave = useCallback(
    async (dataProducts: DataProduct[]) => {
      if (!testCaseData) {
        return;
      }

      const updatedDataProducts = dataProducts.map((dp) => ({
        id: dp.id ?? '',
        type: 'dataProduct',
        name: dp.name,
        fullyQualifiedName: dp.fullyQualifiedName,
        displayName: dp.displayName,
      }));

      const patch = compare(testCaseData, {
        ...testCaseData,
        dataProducts: updatedDataProducts,
      });

      if (patch.length) {
        try {
          const res = await updateTestCaseById(testCaseData.id ?? '', patch);
          setTestCase(res);
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [testCaseData, setTestCase]
  );

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
            refetchChangeSummary();
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
    [testCaseData, updateTestCaseById, setTestCase, refetchChangeSummary]
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
    const items: ParameterDisplayItem[] = [];

    if (isVersionPage) {
      return null;
    }

    if (testCaseData?.useDynamicAssertion) {
      items.push({
        value: (
          <label
            className="parameter-value-text tw:inline-flex"
            data-testid="dynamic-assertion">
            <StarIcon aria-hidden className="tw:h-3 tw:w-3 tw:mr-1 tw:mt-1" />{' '}
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

  return {
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
    parameterItems,
    description,
    descriptionChangeSummaryEntry: changeSummary?.['description'],
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
  };
};
