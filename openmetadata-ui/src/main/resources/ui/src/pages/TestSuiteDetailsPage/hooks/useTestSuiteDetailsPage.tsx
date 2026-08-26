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
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isArray, isEmpty } from 'lodash';
import { PagingResponse } from 'Models';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  NextPreviousProps,
  PagingHandlerParams,
} from '../../../components/common/NextPrevious/NextPrevious.interface';
import { useEntityExportModalProvider } from '../../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { EntityName } from '../../../components/Modals/EntityNameModal/EntityNameModal.interface';
import {
  ES_UPDATE_DELAY,
  INITIAL_PAGING_VALUE,
} from '../../../constants/constants';
import { DEFAULT_SORT_ORDER } from '../../../constants/profiler.constant';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { TestCase } from '../../../generated/tests/testCase';
import { EntityReference, TestSuite } from '../../../generated/tests/testSuite';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useChangeSummary } from '../../../hooks/useChangeSummary';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { useFqn } from '../../../hooks/useFqn';
import {
  DataQualityPageTabs,
  DataQualitySubTabs,
} from '../../../pages/DataQuality/DataQualityPage.interface';
import {
  testSuiteDetailsQueryFn,
  testSuiteDetailsQueryKey,
  testSuiteIngestionPipelinesQueryFn,
  testSuiteIngestionPipelinesQueryKey,
  testSuiteTestCasesQueryFn,
  testSuiteTestCasesQueryKey,
  testSuiteTestCasesQueryKeyPrefix,
  TEST_SUITE_TEST_CASE_FIELDS,
} from '../../../rest/queries/testSuiteQuery';
import {
  addTestCasesToLogicalTestSuiteBulk,
  getListTestCaseBySearch,
  ListTestCaseParamsBySearch,
  updateTestSuiteById,
} from '../../../rest/testAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../../utils/PermissionsUtils';
import { ExtraTestCaseDropdownOptions } from '../../../utils/TestCaseUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { TEST_CASE_LIST_REFRESH_MAX_ATTEMPTS } from '../TestSuiteDetailsPage.constants';
import { UseTestSuiteDetailsPageResult } from '../TestSuiteDetailsPage.interface';
import {
  isTestCaseListSynchronized,
  isUnfilteredTestCaseRequest,
} from '../TestSuiteDetailsPage.utils';

/**
 * Data + handlers for the (bundle) test suite details page. Shared by the
 * OSS renderer (TestSuiteDetailsPage) and the AskCollate AI renderer —
 * each renderer only lays the header and tabs out.
 */
export const useTestSuiteDetailsPage = (): UseTestSuiteDetailsPageResult => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { entityRules } = useEntityRules(EntityType.TEST_SUITE);
  const { getEntityPermissionByFqn, permissions: globalPermissions } =
    usePermissionProvider();
  const { fqn: testSuiteFQN } = useFqn();
  // Query keys isolate stale GET responses, but a bulk mutation can still
  // finish after navigation and must not start follow-up work for the old suite.
  const activeTestSuiteFQN = useRef(testSuiteFQN);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(EntityTabs.TEST_CASES);
  const { showModal } = useEntityExportModalProvider();

  // Keep the raw value for the controlled input while using a normalized value
  // in the query key and API request.
  const [testCaseSearchQuery, setTestCaseSearchQuery] = useState('');
  const [testCaseRequestParams, setTestCaseRequestParams] =
    useState<ListTestCaseParamsBySearch>({
      ...DEFAULT_SORT_ORDER,
      offset: 0,
    });
  // Suite relationships update before the search index; retain the REST total
  // until the keyed list query observes the indexed rows.
  const [authoritativeTestCaseCount, setAuthoritativeTestCaseCount] =
    useState<number>();
  const [isSynchronizingTestCases, setIsSynchronizingTestCases] =
    useState(false);

  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    showPagination,
  } = usePaging();
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] =
    useState<boolean>(false);

  const {
    data: testSuitePermissions = DEFAULT_ENTITY_PERMISSION,
    error: testSuitePermissionError,
    isLoading: isPermissionLoading,
  } = useQuery<OperationPermission>({
    queryKey: ['testSuite', 'permission', testSuiteFQN],
    queryFn: () =>
      getEntityPermissionByFqn(ResourceEntity.TEST_SUITE, testSuiteFQN),
    enabled: Boolean(testSuiteFQN),
  });

  const permissions = useMemo(() => {
    return {
      hasViewPermission:
        testSuitePermissions?.ViewAll || testSuitePermissions?.ViewBasic,
      hasEditPermission: testSuitePermissions?.EditAll,
      hasEditOwnerPermission:
        testSuitePermissions?.EditAll || testSuitePermissions?.EditOwners,
      hasEditDescriptionPermission:
        testSuitePermissions?.EditAll || testSuitePermissions?.EditDescription,
      hasDeletePermission: testSuitePermissions?.Delete,
    };
  }, [testSuitePermissions]);

  const testSuiteQueryKey = useMemo(
    () => testSuiteDetailsQueryKey(testSuiteFQN),
    [testSuiteFQN]
  );
  const {
    data: testSuite,
    error: testSuiteError,
    isLoading: isTestSuiteLoading,
  } = useQuery({
    queryKey: testSuiteQueryKey,
    queryFn: testSuiteDetailsQueryFn(testSuiteFQN),
    enabled: Boolean(testSuiteFQN && permissions.hasViewPermission),
  });

  // The suite page mounts no GenericProvider, so the description
  // attribution must be fetched directly instead of read from context.
  const { changeSummary, refetch: refetchChangeSummary } = useChangeSummary(
    EntityType.TEST_SUITE,
    testSuite?.id ?? '',
    { limit: 1000 }
  );

  const { testSuiteDescription, testSuiteId, testOwners } = useMemo(() => {
    return {
      testOwners: testSuite?.owners,
      testSuiteId: testSuite?.id ?? '',
      testSuiteDescription: testSuite?.description ?? '',
    };
  }, [testSuite]);

  const testCaseQueryParams = useMemo<ListTestCaseParamsBySearch>(
    () => ({
      fields: TEST_SUITE_TEST_CASE_FIELDS,
      testSuiteId,
      ...testCaseRequestParams,
      limit: pageSize,
    }),
    [testSuiteId, testCaseRequestParams, pageSize]
  );
  const testCaseQueryKey = useMemo(
    () => testSuiteTestCasesQueryKey(testSuiteId, testCaseQueryParams),
    [testSuiteId, testCaseQueryParams]
  );
  const {
    data: testCaseResponse,
    error: testCaseError,
    isFetching: isTestCaseQueryFetching,
    refetch: refetchTestCases,
  } = useQuery({
    queryKey: testCaseQueryKey,
    queryFn: testSuiteTestCasesQueryFn(testCaseQueryParams),
    enabled: Boolean(testSuiteId),
    placeholderData: keepPreviousData,
  });

  const { data: ingestionPipelineResponse, error: ingestionPipelineError } =
    useQuery({
      queryKey: testSuiteIngestionPipelinesQueryKey(testSuiteFQN),
      queryFn: testSuiteIngestionPipelinesQueryFn(testSuiteFQN),
      enabled: Boolean(testSuiteId),
    });

  const isUnfilteredTestCaseList = isUnfilteredTestCaseRequest(
    testCaseRequestParams
  );
  const testCasePaging = useMemo(() => {
    const responsePaging = testCaseResponse?.paging ?? { total: 0 };
    const shouldUseAuthoritativeTotal =
      isUnfilteredTestCaseList &&
      authoritativeTestCaseCount !== undefined &&
      responsePaging.total < authoritativeTestCaseCount;

    return {
      ...responsePaging,
      total: shouldUseAuthoritativeTotal
        ? authoritativeTestCaseCount
        : responsePaging.total,
    };
  }, [
    testCaseResponse?.paging,
    isUnfilteredTestCaseList,
    authoritativeTestCaseCount,
  ]);

  const testCaseResult = testCaseResponse?.data ?? [];
  const ingestionPipelineCount = ingestionPipelineResponse?.paging.total ?? 0;
  const isTestCaseLoading = isTestCaseQueryFetching || isSynchronizingTestCases;
  const isLoading = isPermissionLoading || isTestSuiteLoading;

  const extraDropdownContent = useMemo(() => {
    const bulkImportExportTestCasePermission = {
      ViewAll:
        checkPermission(
          Operation.ViewAll,
          ResourceEntity.TEST_CASE,
          globalPermissions
        ) ?? false,
      EditAll:
        checkPermission(
          Operation.EditAll,
          ResourceEntity.TEST_CASE,
          globalPermissions
        ) ?? false,
    };

    return ExtraTestCaseDropdownOptions(
      testSuite?.fullyQualifiedName ?? '',
      bulkImportExportTestCasePermission,
      testSuite?.deleted ?? false,
      navigate,
      showModal,
      EntityType.TEST_SUITE
    );
  }, [globalPermissions, testSuite, navigate, showModal]);

  const slashedBreadCrumb = useMemo(
    () => [
      {
        name: t('label.test-suite-plural'),
        url: observabilityRouterClassBase.getDataQualityPagePath(
          DataQualityPageTabs.TEST_SUITES,
          DataQualitySubTabs.BUNDLE_SUITES
        ),
      },
      {
        name: getEntityName(testSuite),
        url: '',
      },
    ],
    [testSuite, t]
  );

  const incidentUrlState = useMemo(() => {
    return [
      {
        name: t('label.test-suite-plural'),
        url: observabilityRouterClassBase.getDataQualityPagePath(
          DataQualityPageTabs.TEST_SUITES,
          DataQualitySubTabs.BUNDLE_SUITES
        ),
      },
      {
        name: getEntityName(testSuite),
        url: observabilityRouterClassBase.getTestSuitePath(
          testSuite?.fullyQualifiedName ?? ''
        ),
      },
    ];
  }, [testSuite, t]);

  const saveAndUpdateTestSuiteData = useCallback(
    (updatedData: TestSuite) => {
      const jsonPatch = compare(testSuite as TestSuite, updatedData);

      return updateTestSuiteById(testSuiteId, jsonPatch);
    },
    [testSuite, testSuiteId]
  );

  useEffect(() => {
    if (testSuitePermissionError) {
      showErrorToast(testSuitePermissionError as AxiosError);
    }
  }, [testSuitePermissionError]);

  useEffect(() => {
    if (testSuiteError) {
      showErrorToast(
        testSuiteError as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.test-suite'),
        })
      );
    }
  }, [testSuiteError, t]);

  useEffect(() => {
    if (testCaseError) {
      showErrorToast(
        testCaseError as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.test-case-plural'),
        })
      );
    }
  }, [testCaseError, t]);

  useEffect(() => {
    if (ingestionPipelineError) {
      showErrorToast(ingestionPipelineError as AxiosError);
    }
  }, [ingestionPipelineError]);

  useEffect(() => {
    handlePagingChange(testCasePaging);

    if (
      isUnfilteredTestCaseList &&
      authoritativeTestCaseCount !== undefined &&
      (testCaseResponse?.paging.total ?? 0) >= authoritativeTestCaseCount
    ) {
      setAuthoritativeTestCaseCount(undefined);
    }
  }, [
    testCasePaging,
    handlePagingChange,
    isUnfilteredTestCaseList,
    authoritativeTestCaseCount,
    testCaseResponse?.paging.total,
  ]);

  const fetchTestCases = useCallback(
    async (param?: ListTestCaseParamsBySearch) => {
      if (!param) {
        await refetchTestCases();

        return;
      }

      setTestCaseRequestParams((current) => ({
        ...current,
        ...param,
      }));
    },
    [refetchTestCases]
  );

  const handleTestCaseSearch = useCallback(
    async (query: string) => {
      setTestCaseSearchQuery(query);
      handlePageChange(INITIAL_PAGING_VALUE);
      await fetchTestCases({ offset: 0, q: query.trim() || undefined });
    },
    [fetchTestCases, handlePageChange]
  );

  const fetchIndexedTestCaseTotal = useCallback(
    async (targetTestSuiteId: string) => {
      const response = await getListTestCaseBySearch({
        testSuiteId: targetTestSuiteId,
        limit: 1,
      });

      return response.paging.total;
    },
    []
  );

  const refreshTestCasesUntilIndexed = useCallback(
    async (
      authoritativeTotal: number | undefined,
      isCurrentTestSuite: () => boolean,
      targetTestSuiteId: string
    ) => {
      if (!isCurrentTestSuite()) {
        return;
      }

      setIsSynchronizingTestCases(true);
      try {
        for (
          let attempt = 0;
          attempt < TEST_CASE_LIST_REFRESH_MAX_ATTEMPTS;
          attempt++
        ) {
          if (!isCurrentTestSuite()) {
            return;
          }

          // Polling reads only the index total so it cannot supersede or
          // commit over a search, sort, or paging request made meanwhile.
          const indexedTotal = await fetchIndexedTestCaseTotal(
            targetTestSuiteId
          );

          if (!isCurrentTestSuite()) {
            return;
          }

          if (isTestCaseListSynchronized(indexedTotal, authoritativeTotal)) {
            break;
          }

          if (attempt < TEST_CASE_LIST_REFRESH_MAX_ATTEMPTS - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, ES_UPDATE_DELAY)
            );
          }
        }

        if (isCurrentTestSuite()) {
          // Invalidating the suite prefix refetches whichever search, sort, or
          // page query is active when indexing completes.
          await queryClient.invalidateQueries({
            queryKey: testSuiteTestCasesQueryKeyPrefix(targetTestSuiteId),
          });
        }
      } finally {
        if (isCurrentTestSuite()) {
          setIsSynchronizingTestCases(false);
        }
      }
    },
    [fetchIndexedTestCaseTotal, queryClient]
  );

  const handleSortTestCase = useCallback(
    async (apiParams?: ListTestCaseParamsBySearch) => {
      await fetchTestCases({ ...(apiParams ?? DEFAULT_SORT_ORDER), offset: 0 });
      handlePageChange(INITIAL_PAGING_VALUE);
    },
    [fetchTestCases, handlePageChange]
  );

  const handleAddTestCaseSubmit = useCallback(
    async (payload: {
      selectAll: boolean;
      includeIds: string[];
      excludeIds: string[];
    }) => {
      if (!testSuiteId) {
        return;
      }
      const submittedTestSuiteFQN = testSuiteFQN;
      const isCurrentTestSuite = () =>
        submittedTestSuiteFQN === activeTestSuiteFQN.current;

      try {
        await addTestCasesToLogicalTestSuiteBulk(testSuiteId, payload);

        if (!isCurrentTestSuite()) {
          return;
        }

        setIsTestCaseModalOpen(false);
        const updatedTestSuite = await queryClient.fetchQuery({
          queryKey: testSuiteDetailsQueryKey(submittedTestSuiteFQN),
          queryFn: testSuiteDetailsQueryFn(submittedTestSuiteFQN),
        });

        if (!isCurrentTestSuite()) {
          return;
        }

        const authoritativeTotal = updatedTestSuite?.tests?.length;

        if (authoritativeTotal !== undefined) {
          setAuthoritativeTestCaseCount(authoritativeTotal);
        }

        await refreshTestCasesUntilIndexed(
          authoritativeTotal,
          isCurrentTestSuite,
          testSuiteId
        );
      } catch (error) {
        if (isCurrentTestSuite()) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [testSuiteId, testSuiteFQN, queryClient, refreshTestCasesUntilIndexed]
  );

  const updateTestSuiteData = useCallback(
    async (updatedTestSuite: TestSuite) => {
      try {
        const response = await saveAndUpdateTestSuiteData(updatedTestSuite);
        queryClient.setQueryData(testSuiteQueryKey, response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [queryClient, saveAndUpdateTestSuiteData, testSuiteQueryKey]
  );

  const onUpdateOwner = useCallback(
    async (updatedOwners: TestSuite['owners']) => {
      if (!testSuite) {
        return;
      }

      await updateTestSuiteData({ ...testSuite, owners: updatedOwners });
    },
    [testSuite, updateTestSuiteData]
  );

  const handleDomainUpdate = useCallback(
    async (updateDomain?: EntityReference | EntityReference[]) => {
      if (!testSuite) {
        return;
      }

      let domains: EntityReference[];
      if (isArray(updateDomain)) {
        domains = updateDomain;
      } else if (isEmpty(updateDomain)) {
        domains = [];
      } else {
        domains = [updateDomain];
      }

      const updatedTestSuite: TestSuite = {
        ...testSuite,
        domains,
      };

      await updateTestSuiteData(updatedTestSuite);
    },
    [testSuite, updateTestSuiteData]
  );

  const onDescriptionUpdate = useCallback(
    async (updatedHTML: string) => {
      if (testSuite && testSuite.description !== updatedHTML) {
        const updatedTestSuite = { ...testSuite, description: updatedHTML };
        try {
          const response = await saveAndUpdateTestSuiteData(
            updatedTestSuite as TestSuite
          );
          if (response) {
            queryClient.setQueryData(testSuiteQueryKey, response);
            refetchChangeSummary();
          } else {
            throw t('server.unexpected-response');
          }
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [
      testSuite,
      t,
      refetchChangeSummary,
      saveAndUpdateTestSuiteData,
      queryClient,
      testSuiteQueryKey,
    ]
  );

  const handleDisplayNameChange = useCallback(
    async (entityName?: EntityName) => {
      try {
        if (testSuite) {
          const updatedTestSuite = {
            ...testSuite,
            ...entityName,
          };
          const jsonPatch = compare(testSuite, updatedTestSuite);

          if (jsonPatch.length && testSuite.id) {
            const response = await saveAndUpdateTestSuiteData(
              updatedTestSuite as TestSuite
            );

            queryClient.setQueryData(testSuiteQueryKey, response);
          }
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [testSuite, saveAndUpdateTestSuiteData, queryClient, testSuiteQueryKey]
  );

  const handleTestCasePaging = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      if (currentPage) {
        handlePageChange(currentPage);
        fetchTestCases({
          offset: (currentPage - 1) * pageSize,
        });
      }
    },
    [fetchTestCases, handlePageChange, pageSize]
  );

  const handleTestSuiteUpdate = useCallback(
    (testCase?: TestCase) => {
      if (testCase) {
        queryClient.setQueryData<PagingResponse<TestCase[]>>(
          testCaseQueryKey,
          (current) =>
            current
              ? {
                  ...current,
                  data: current.data.map((item) =>
                    item.id === testCase.id ? { ...item, ...testCase } : item
                  ),
                }
              : current
        );
      }
    },
    [queryClient, testCaseQueryKey]
  );

  useLayoutEffect(() => {
    activeTestSuiteFQN.current = testSuiteFQN;
    setAuthoritativeTestCaseCount(undefined);
    setTestCaseSearchQuery('');
    setTestCaseRequestParams({
      ...DEFAULT_SORT_ORDER,
      offset: 0,
    });
    setIsSynchronizingTestCases(false);
    setIsTestCaseModalOpen(false);
  }, [testSuiteFQN]);

  const handleTestCasePageSizeChange = useCallback(
    (size: number) => {
      setTestCaseRequestParams((current) => ({
        ...current,
        offset: 0,
      }));
      handlePageSizeChange(size);
    },
    [handlePageSizeChange]
  );

  const pagingData: NextPreviousProps = useMemo(
    () => ({
      isNumberBased: true,
      currentPage,
      pageSize,
      paging,
      onShowSizeChange: handleTestCasePageSizeChange,
      pagingHandler: handleTestCasePaging,
    }),
    [
      currentPage,
      paging,
      pageSize,
      handleTestCasePageSizeChange,
      handleTestCasePaging,
    ]
  );

  return {
    testSuite,
    testSuiteDescription,
    descriptionChangeSummaryEntry: changeSummary?.['description'],
    testOwners,
    isLoading,
    isTestCaseLoading,
    testCaseResult,
    testCaseSearchQuery,
    testSuitePermissions,
    permissions,
    extraDropdownContent,
    activeTab,
    setActiveTab,
    isTestCaseModalOpen,
    setIsTestCaseModalOpen,
    slashedBreadCrumb,
    incidentUrlState,
    pagingData,
    showPagination,
    ingestionPipelineCount,
    canAddMultipleDomains: entityRules.canAddMultipleDomains,
    canAddMultipleUserOwners: entityRules.canAddMultipleUserOwners,
    canAddMultipleTeamOwner: entityRules.canAddMultipleTeamOwner,
    fetchTestCases,
    handleTestCaseSearch,
    handleSortTestCase,
    handleAddTestCaseSubmit,
    onUpdateOwner,
    handleDomainUpdate,
    onDescriptionUpdate,
    handleDisplayNameChange,
    handleTestSuiteUpdate,
  };
};
