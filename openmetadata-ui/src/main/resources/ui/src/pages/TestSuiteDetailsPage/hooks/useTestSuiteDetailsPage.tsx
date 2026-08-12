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
import { isArray, isEmpty } from 'lodash';
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
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
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
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../../enums/entity.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCase } from '../../../generated/tests/testCase';
import { EntityReference, TestSuite } from '../../../generated/tests/testSuite';
import { Include } from '../../../generated/type/include';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useChangeSummary } from '../../../hooks/useChangeSummary';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { useFqn } from '../../../hooks/useFqn';
import {
  DataQualityPageTabs,
  DataQualitySubTabs,
} from '../../../pages/DataQuality/DataQualityPage.interface';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import {
  addTestCasesToLogicalTestSuiteBulk,
  getListTestCaseBySearch,
  getTestSuiteByName,
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
  shouldResetTestCaseLoading,
} from '../TestSuiteDetailsPage.utils';

/**
 * Data + handlers for the (bundle) test suite details page. Shared by the
 * OSS renderer (TestSuiteDetailsPage) and the AskCollate AI renderer —
 * each renderer only lays the header and tabs out.
 */
export const useTestSuiteDetailsPage = (): UseTestSuiteDetailsPageResult => {
  const { t } = useTranslation();
  const { entityRules } = useEntityRules(EntityType.TEST_SUITE);
  const { getEntityPermissionByFqn, permissions: globalPermissions } =
    usePermissionProvider();
  const { fqn: testSuiteFQN } = useFqn();
  const activeTestSuiteFQN = useRef(testSuiteFQN);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(EntityTabs.TEST_CASES);
  const { showModal } = useEntityExportModalProvider();

  const [testSuite, setTestSuite] = useState<TestSuite>();
  const [isTestCaseLoading, setIsTestCaseLoading] = useState(true);
  const [testCaseResult, setTestCaseResult] = useState<Array<TestCase>>([]);
  const testCaseRequestId = useRef(0);
  const testSuiteRequestId = useRef(0);
  const authoritativeTestCaseCount = useRef<{
    testSuiteFQN: string;
    total: number;
  }>();

  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    showPagination,
  } = usePaging();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testSuitePermissions, setTestSuitePermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] =
    useState<boolean>(false);
  const [sortOptions, setSortOptions] =
    useState<ListTestCaseParamsBySearch>(DEFAULT_SORT_ORDER);
  const [ingestionPipelineCount, setIngestionPipelineCount] =
    useState<number>(0);

  const [slashedBreadCrumb, setSlashedBreadCrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

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
  }, [testSuite]);

  const saveAndUpdateTestSuiteData = (updatedData: TestSuite) => {
    const jsonPatch = compare(testSuite as TestSuite, updatedData);

    return updateTestSuiteById(testSuiteId as string, jsonPatch);
  };

  const fetchTestSuitePermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.TEST_SUITE,
        testSuiteFQN
      );
      setTestSuitePermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchIngestionPipelineCount = useCallback(
    async (
      shouldFetch: boolean,
      isCurrentRequest: () => boolean
    ): Promise<void> => {
      if (!shouldFetch || !isCurrentRequest()) {
        return;
      }

      const { paging: ingestionPipelinePaging } = await getIngestionPipelines({
        arrQueryFields: [],
        testSuite: testSuiteFQN,
        pipelineType: [PipelineType.TestSuite],
        limit: 0,
      });

      if (isCurrentRequest()) {
        setIngestionPipelineCount(ingestionPipelinePaging.total);
      }
    },
    [testSuiteFQN]
  );

  const fetchTestCasesWithTotal = useCallback(
    async (
      param?: ListTestCaseParamsBySearch,
      keepLoading = false,
      shouldFetchIngestionPipelines = true
    ): Promise<number | undefined> => {
      const requestId = ++testCaseRequestId.current;
      const requestedTestSuiteFQN = testSuiteFQN;
      const isCurrentRequest = () =>
        requestId === testCaseRequestId.current &&
        requestedTestSuiteFQN === activeTestSuiteFQN.current;
      setIsTestCaseLoading(true);
      try {
        const response = await getListTestCaseBySearch({
          fields: [
            TabSpecificField.TEST_CASE_RESULT,
            TabSpecificField.TEST_DEFINITION,
            TabSpecificField.TESTSUITE,
            TabSpecificField.INCIDENT_ID,
            TabSpecificField.INCIDENT_STATUS,
          ],
          testSuiteId,
          ...sortOptions,
          ...param,
          limit: pageSize,
        });
        await fetchIngestionPipelineCount(
          shouldFetchIngestionPipelines,
          isCurrentRequest
        );

        if (!isCurrentRequest()) {
          return;
        }

        const authoritativeSnapshot = authoritativeTestCaseCount.current;
        const isUnfilteredRequest = isUnfilteredTestCaseRequest(param);
        const shouldUseAuthoritativeTotal =
          isUnfilteredRequest &&
          authoritativeSnapshot?.testSuiteFQN === testSuiteFQN &&
          response.paging.total < authoritativeSnapshot.total;
        setTestCaseResult(response.data);
        handlePagingChange({
          ...response.paging,
          total: shouldUseAuthoritativeTotal
            ? authoritativeSnapshot.total
            : response.paging.total,
        });

        if (
          authoritativeSnapshot &&
          isUnfilteredRequest &&
          !shouldUseAuthoritativeTotal
        ) {
          authoritativeTestCaseCount.current = undefined;
        }

        return response.paging.total;
      } catch {
        if (!isCurrentRequest()) {
          return;
        }

        setTestCaseResult([]);
        showErrorToast(
          t('server.entity-fetch-error', {
            entity: t('label.test-case-plural'),
          })
        );
      } finally {
        if (shouldResetTestCaseLoading(isCurrentRequest, keepLoading)) {
          setIsTestCaseLoading(false);
        }
      }
    },
    [
      testSuiteId,
      testSuiteFQN,
      sortOptions,
      pageSize,
      handlePagingChange,
      fetchIngestionPipelineCount,
      t,
    ]
  );

  const fetchTestCases = useCallback(
    async (param?: ListTestCaseParamsBySearch) => {
      await fetchTestCasesWithTotal(param);
    },
    [fetchTestCasesWithTotal]
  );

  const refreshTestCasesUntilIndexed = useCallback(
    async (
      authoritativeTotal: number | undefined,
      isCurrentTestSuite: () => boolean
    ) => {
      setIsTestCaseLoading(true);
      try {
        for (
          let attempt = 0;
          attempt < TEST_CASE_LIST_REFRESH_MAX_ATTEMPTS;
          attempt++
        ) {
          if (!isCurrentTestSuite()) {
            return;
          }

          const indexedTotal = await fetchTestCasesWithTotal(
            undefined,
            true,
            attempt === 0
          );

          if (
            !isCurrentTestSuite() ||
            isTestCaseListSynchronized(indexedTotal, authoritativeTotal)
          ) {
            return;
          }

          if (attempt < TEST_CASE_LIST_REFRESH_MAX_ATTEMPTS - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, ES_UPDATE_DELAY)
            );
          }
        }
      } finally {
        if (isCurrentTestSuite()) {
          setIsTestCaseLoading(false);
        }
      }
    },
    [fetchTestCasesWithTotal]
  );

  const handleSortTestCase = useCallback(
    async (apiParams?: ListTestCaseParamsBySearch) => {
      setSortOptions(apiParams ?? DEFAULT_SORT_ORDER);
      await fetchTestCases({ ...(apiParams ?? DEFAULT_SORT_ORDER), offset: 0 });
      handlePageChange(INITIAL_PAGING_VALUE);
    },
    [fetchTestCases, handlePageChange]
  );

  const fetchTestSuiteByName = useCallback(async () => {
    const requestId = ++testSuiteRequestId.current;
    const requestedTestSuiteFQN = testSuiteFQN;
    const isCurrentRequest = () =>
      requestId === testSuiteRequestId.current &&
      requestedTestSuiteFQN === activeTestSuiteFQN.current;

    try {
      const response = await getTestSuiteByName(testSuiteFQN, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.DOMAINS,
          TabSpecificField.TESTS,
        ],
        include: Include.All,
      });

      if (!isCurrentRequest()) {
        return;
      }

      setSlashedBreadCrumb([
        {
          name: t('label.test-suite-plural'),
          url: observabilityRouterClassBase.getDataQualityPagePath(
            DataQualityPageTabs.TEST_SUITES,
            DataQualitySubTabs.BUNDLE_SUITES
          ),
        },
        {
          name: getEntityName(response),
          url: '',
        },
      ]);
      setTestSuite(response);

      return response;
    } catch (error) {
      if (!isCurrentRequest()) {
        return;
      }

      setTestSuite(undefined);
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.test-suite'),
        })
      );
    }
  }, [testSuiteFQN, t]);

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
        const updatedTestSuite = await fetchTestSuiteByName();

        if (!isCurrentTestSuite()) {
          return;
        }

        const authoritativeTotal = updatedTestSuite?.tests?.length;

        if (authoritativeTotal !== undefined) {
          authoritativeTestCaseCount.current = {
            testSuiteFQN,
            total: authoritativeTotal,
          };
          handlePagingChange((currentPaging) => ({
            ...currentPaging,
            total: authoritativeTotal,
          }));
        }

        await refreshTestCasesUntilIndexed(
          authoritativeTotal,
          isCurrentTestSuite
        );
      } catch (error) {
        if (isCurrentTestSuite()) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [
      testSuiteId,
      testSuiteFQN,
      fetchTestSuiteByName,
      refreshTestCasesUntilIndexed,
      handlePagingChange,
    ]
  );

  const updateTestSuiteData = async (updatedTestSuite: TestSuite) => {
    try {
      const res = await saveAndUpdateTestSuiteData(updatedTestSuite);
      setTestSuite(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onUpdateOwner = useCallback(
    async (updatedOwners: TestSuite['owners']) => {
      if (!testSuite) {
        return;
      }

      await updateTestSuiteData({ ...testSuite, owners: updatedOwners });
    },
    [testSuite]
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
    [testSuite]
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
            setTestSuite(response);
            refetchChangeSummary();
          } else {
            throw t('server.unexpected-response');
          }
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [testSuite, t, refetchChangeSummary]
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

            setTestSuite(response);
          }
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [testSuite]
  );

  const handleTestCasePaging = ({ currentPage }: PagingHandlerParams) => {
    if (currentPage) {
      handlePageChange(currentPage);
      fetchTestCases({
        offset: (currentPage - 1) * pageSize,
      });
    }
  };

  const handleTestSuiteUpdate = useCallback((testCase?: TestCase) => {
    if (testCase) {
      setTestCaseResult((prev) =>
        prev.map((test) =>
          test.id === testCase.id ? { ...test, ...testCase } : test
        )
      );
    }
  }, []);

  useLayoutEffect(() => {
    activeTestSuiteFQN.current = testSuiteFQN;
    testCaseRequestId.current += 1;
    testSuiteRequestId.current += 1;
    authoritativeTestCaseCount.current = undefined;
  }, [testSuiteFQN]);

  useEffect(() => {
    if (permissions.hasViewPermission) {
      fetchTestSuiteByName();
    }
  }, [permissions, testSuiteFQN]);

  useEffect(() => {
    fetchTestSuitePermission();
  }, [testSuiteFQN]);

  useEffect(() => {
    if (testSuiteId) {
      fetchTestCases({ testSuiteId });
    }
  }, [testSuiteId, pageSize]);

  const pagingData: NextPreviousProps = useMemo(
    () => ({
      isNumberBased: true,
      currentPage,
      pageSize,
      paging,
      onShowSizeChange: handlePageSizeChange,
      pagingHandler: handleTestCasePaging,
    }),
    [currentPage, paging, pageSize, handlePageSizeChange, handleTestCasePaging]
  );

  return {
    testSuite,
    testSuiteDescription,
    descriptionChangeSummaryEntry: changeSummary?.['description'],
    testOwners,
    isLoading,
    isTestCaseLoading,
    testCaseResult,
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
    handleSortTestCase,
    handleAddTestCaseSubmit,
    onUpdateOwner,
    handleDomainUpdate,
    onDescriptionUpdate,
    handleDisplayNameChange,
    handleTestSuiteUpdate,
  };
};
