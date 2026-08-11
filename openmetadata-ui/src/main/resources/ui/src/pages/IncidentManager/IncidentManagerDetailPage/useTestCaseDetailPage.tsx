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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { compare, Operation as PatchOperation } from 'fast-json-patch';
import { isUndefined, toString } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DimensionIcon } from '../../../assets/svg/data-observability/dimension.svg';
import { ManageButtonItemLabel } from '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { EntityName } from '../../../components/Modals/EntityNameModal/EntityNameModal.interface';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  ChangeDescription,
  EntityReference,
  TestCase,
} from '../../../generated/tests/testCase';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import {
  testCaseQueryFn,
  testCaseQueryKey,
} from '../../../rest/queries/incidentManagerQuery';
import {
  getTestCaseVersionDetails,
  getTestCaseVersionList,
  updateTestCaseById,
} from '../../../rest/testAPI';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtilsPure';
import {
  fetchEntityTaskCountsInto,
  getFeedCounts,
} from '../../../utils/FeedUtilsPure';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { TestCasePageTabs } from '../IncidentManager.interface';
import testCaseClassBase, { TestCaseTabType } from './TestCaseClassBase';
import { useTestCaseStore } from './useTestCase.store';

export interface UseTestCaseDetailPageProps {
  isVersionPage?: boolean;
}

export interface UseTestCaseDetailPageResult {
  testCase: TestCase | undefined;
  testCaseFQN: string;
  isLoading: boolean;
  testCasePermission: OperationPermission | undefined;
  hasViewPermission: boolean | undefined;
  hasEditPermission: boolean | undefined;
  hasDeletePermission: boolean | undefined;
  editDisplayNamePermission: boolean | undefined;
  feedCount: FeedCounts;
  displayName: string | undefined;
  tabs: TestCaseTabType[];
  activeTab: EntityTabs | TestCasePageTabs;
  handleTabChange: (activeKey: string) => void;
  isExpandViewSupported: boolean;
  isTabExpanded: boolean;
  toggleTabExpanded: () => void;
  version: string;
  versionList: EntityHistory;
  versionHandler: (newVersion?: string) => void;
  onVersionClick: () => void;
  isDimensionPage: boolean;
  dimensionKey: string | undefined;
  isDimensionEdit: boolean;
  setIsDimensionEdit: (isDimensionEdit: boolean) => void;
  handleCancelDimension: () => void;
  extraDropdownContent: Array<{
    key: string;
    label: ReactNode;
    onClick: () => void;
  }>;
  handleOwnerChange: (owners?: EntityReference[]) => Promise<void>;
  handleDisplayNameChange: (entityName?: EntityName) => Promise<void>;
  getEntityFeedCount: () => void;
  setTestCase: (testCase: TestCase) => void;
}

/**
 * Data + handlers for the test-case detail page (details, version, and
 * dimension variants). Shared by the OSS antd renderer
 * (IncidentManagerDetailPage) and the AskCollate AI renderer — chrome
 * (breadcrumbs, tab labels, layout) stays in each renderer.
 */
export const useTestCaseDetailPage = ({
  isVersionPage = false,
}: UseTestCaseDetailPageProps = {}): UseTestCaseDetailPageResult => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    tab: activeTab = TestCasePageTabs.TEST_CASE_RESULTS,
    version,
    dimensionKey,
  } = useRequiredParams<{
    tab: EntityTabs;
    version: string;
    dimensionKey?: string;
  }>();

  const { fqn: testCaseFQN } = useFqn();
  const isDimensionPage = Boolean(dimensionKey);

  const {
    setIsLoading,
    setTestCase,
    testCase,
    reset,
    isPermissionLoading,
    testCasePermission,
    setTestCasePermission,
    setIsPermissionLoading,
    isTabExpanded,
    setIsTabExpanded,
  } = useTestCaseStore();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [versionList, setVersionList] = useState<EntityHistory>({
    entityType: EntityType.TEST_CASE,
    versions: [],
  });
  const [isDimensionEdit, setIsDimensionEdit] = useState<boolean>(false);

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const {
    hasViewPermission,
    editDisplayNamePermission,
    hasDeletePermission,
    hasEditPermission,
  } = useMemo(() => {
    return {
      hasViewPermission:
        testCasePermission?.ViewAll || testCasePermission?.ViewBasic,
      editDisplayNamePermission:
        testCasePermission?.EditAll || testCasePermission?.EditDisplayName,
      hasDeletePermission: testCasePermission?.Delete,
      hasEditPermission: testCasePermission?.EditAll,
    };
  }, [testCasePermission]);

  const testCaseFields = useMemo(() => testCaseClassBase.getFields(), []);

  const testCaseCacheKey = useMemo(
    () => testCaseQueryKey(testCaseFQN, testCaseFields),
    [testCaseFQN, testCaseFields]
  );

  const {
    data: testCaseData,
    isLoading: testCaseLoading,
    error: testCaseError,
  } = useQuery({
    queryKey: testCaseCacheKey,
    queryFn: testCaseQueryFn(testCaseFQN, testCaseFields),
    enabled: Boolean(testCaseFQN && hasViewPermission && !isPermissionLoading),
  });

  const setEntityDetails = useCallback(
    (
      updater:
        | TestCase
        | undefined
        | ((prev: TestCase | undefined) => TestCase | undefined)
    ) => {
      queryClient.setQueryData<TestCase | undefined>(testCaseCacheKey, updater);
    },
    [queryClient, testCaseCacheKey]
  );

  // Mirror query data into the Zustand store so child components
  // (TestCaseResultTab, IncidentTab, page header) — which read directly from
  // {@code useTestCaseStore} — continue to receive updates without having to
  // be migrated to React Query themselves.
  useEffect(() => {
    if (testCaseData) {
      testCaseClassBase.setShowSqlQueryTab(
        !isUndefined(testCaseData.inspectionQuery)
      );
      setTestCase(testCaseData);
    }
  }, [testCaseData, setTestCase]);

  useEffect(() => {
    setIsLoading(testCaseLoading);
  }, [testCaseLoading, setIsLoading]);

  useEffect(() => {
    if (testCaseError) {
      showErrorToast(
        testCaseError as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.test-case') })
      );
    }
  }, [testCaseError, t]);

  useEffect(() => {
    if (!isVersionPage || !testCaseData?.id) {
      return;
    }
    getTestCaseVersionList(testCaseData.id)
      .then(setVersionList)
      .catch((error) => showErrorToast(error as AxiosError));
  }, [isVersionPage, testCaseData?.id]);

  const isExpandViewSupported = useMemo(
    () => activeTab === TestCasePageTabs.TEST_CASE_RESULTS,
    [activeTab]
  );

  const toggleTabExpanded = useCallback(() => {
    setIsTabExpanded(!isTabExpanded);
  }, [isTabExpanded, setIsTabExpanded]);

  const tabs = useMemo(() => {
    const isDimensionalityTabVisible =
      testCase?.dimensionColumns && testCase.dimensionColumns.length > 0;

    return testCaseClassBase.getTab(
      feedCount.openTaskCount,
      isVersionPage,
      isDimensionalityTabVisible
    );
  }, [
    feedCount.openTaskCount,
    testCaseClassBase.showSqlQueryTab,
    testCase?.dimensionColumns,
    isVersionPage,
  ]);

  const fetchTestCasePermission = async () => {
    setIsPermissionLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.TEST_CASE,
        testCaseFQN
      );

      setTestCasePermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPermissionLoading(false);
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      const testCaseDetailsPath = isDimensionPage
        ? observabilityRouterClassBase.getTestCaseDimensionsDetailPagePath(
            testCaseFQN,
            dimensionKey || '',
            activeKey as TestCasePageTabs
          )
        : observabilityRouterClassBase.getTestCaseDetailPagePath(
            testCaseFQN,
            activeKey as TestCasePageTabs
          );

      navigate(
        isVersionPage
          ? observabilityRouterClassBase.getTestCaseVersionPath(
              testCaseFQN,
              version,
              activeKey
            )
          : testCaseDetailsPath
      );
    }
  };
  const updateTestCase = useCallback(
    async (id: string, patch: PatchOperation[]) => {
      try {
        const res = await updateTestCaseById(id, patch);
        setEntityDetails(res);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [setEntityDetails]
  );
  const handleOwnerChange = async (owners?: EntityReference[]) => {
    if (testCase) {
      const updatedTestCase = {
        ...testCase,
        owners,
      };
      const jsonPatch = compare(testCase, updatedTestCase);

      if (jsonPatch.length && testCase.id) {
        await updateTestCase(testCase.id, jsonPatch);
      }
    }
  };

  const handleDisplayNameChange = async (entityName?: EntityName) => {
    try {
      if (testCase) {
        const updatedTestCase = {
          ...testCase,
          ...entityName,
        };
        const jsonPatch = compare(testCase, updatedTestCase);

        if (jsonPatch.length && testCase.id) {
          await updateTestCase(testCase.id, jsonPatch);
        }
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = useCallback(() => {
    getFeedCounts(EntityType.TEST_CASE, testCaseFQN, handleFeedCount);
  }, [testCaseFQN]);

  // Only the open-task count is used here (tab badge); skip the
  // activity-events fetch that getFeedCounts would bundle in.
  const fetchTaskCounts = useCallback(() => {
    if (testCaseFQN) {
      fetchEntityTaskCountsInto(testCaseFQN, setFeedCount);
    }
  }, [testCaseFQN]);

  const handleCancelDimension = useCallback(
    () => setIsDimensionEdit(false),
    []
  );

  const onVersionClick = () => {
    navigate(
      isVersionPage
        ? observabilityRouterClassBase.getTestCaseDetailPagePath(testCaseFQN)
        : observabilityRouterClassBase.getTestCaseVersionPath(
            testCaseFQN,
            toString(testCase?.version) ?? '',
            activeTab
          )
    );
  };

  const versionHandler = useCallback(
    (newVersion = version) => {
      navigate(
        observabilityRouterClassBase.getTestCaseVersionPath(
          testCaseFQN,
          toString(newVersion),
          activeTab
        )
      );
    },
    [testCaseFQN, activeTab]
  );
  const fetchCurrentVersion = async (id: string) => {
    try {
      const response = await getTestCaseVersionDetails(id, version);
      setTestCase(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const displayName = useMemo(() => {
    return isVersionPage
      ? getEntityVersionByField(
          testCase?.changeDescription as ChangeDescription,
          EntityField.DISPLAYNAME,
          testCase?.displayName
        )
      : testCase?.displayName;
  }, [testCase?.changeDescription, testCase?.displayName, isVersionPage]);

  useEffect(() => {
    if (testCaseFQN) {
      fetchTestCasePermission();
    }
  }, [testCaseFQN]);

  useEffect(() => {
    if (hasViewPermission && testCaseFQN) {
      fetchTaskCounts();
    }

    return () => {
      reset();
      testCaseClassBase.setShowSqlQueryTab(false);
    };
  }, [testCaseFQN, hasViewPermission]);

  useEffect(() => {
    if (testCase?.id && isVersionPage) {
      fetchCurrentVersion(testCase.id);
    }
  }, [version, testCase?.id, isVersionPage]);

  const extraDropdownContent = useMemo(() => {
    const isColumn = testCase?.entityLink.includes('::columns::');

    if (!hasEditPermission || isVersionPage || !isColumn) {
      return [];
    }

    return [
      {
        key: 'edit-dimensions',
        label: (
          <ManageButtonItemLabel
            description={t('message.edit-dimension-description')}
            icon={DimensionIcon}
            id="profiler-setting-button"
            name={t('label.dimension-plural')}
          />
        ),
        onClick: () => setIsDimensionEdit(true),
      },
    ];
  }, [t, hasEditPermission, isVersionPage, testCase?.entityLink]);

  return {
    testCase,
    testCaseFQN,
    isLoading: isPermissionLoading || testCaseLoading,
    testCasePermission,
    hasViewPermission,
    hasEditPermission,
    hasDeletePermission,
    editDisplayNamePermission,
    feedCount,
    displayName,
    tabs,
    activeTab,
    handleTabChange,
    isExpandViewSupported,
    isTabExpanded,
    toggleTabExpanded,
    version,
    versionList,
    versionHandler,
    onVersionClick,
    isDimensionPage,
    dimensionKey,
    isDimensionEdit,
    setIsDimensionEdit,
    handleCancelDimension,
    extraDropdownContent,
    handleOwnerChange,
    handleDisplayNameChange,
    getEntityFeedCount,
    setTestCase,
  };
};
