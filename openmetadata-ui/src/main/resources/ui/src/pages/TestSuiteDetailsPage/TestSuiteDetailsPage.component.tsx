/*
 *  Copyright 2022 Collate.
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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isArray, isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TestSuiteIcon } from '../../assets/svg/icon-test-suite.svg';
import { DomainLabel } from '../../components/common/DomainLabel/DomainLabel.component';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ManageButton from '../../components/common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import {
  NextPreviousProps,
  PagingHandlerParams,
} from '../../components/common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../../components/common/OwnerLabel/OwnerLabel.component';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import DataQualityTab from '../../components/Database/Profiler/DataQualityTab/DataQualityTab';
import { AddTestCaseList } from '../../components/DataQuality/AddTestCaseList/AddTestCaseList.component';
import TestSuitePipelineTab from '../../components/DataQuality/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component';
import { useEntityExportModalProvider } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import EntityHeaderTitle from '../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { LearningIcon } from '../../components/Learning/LearningIcon/LearningIcon.component';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { INITIAL_PAGING_VALUE } from '../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { DEFAULT_SORT_ORDER } from '../../constants/profiler.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
import { Operation } from '../../generated/entity/policies/policy';
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCase } from '../../generated/tests/testCase';
import { EntityReference, TestSuite } from '../../generated/tests/testSuite';
import { Include } from '../../generated/type/include';
import { usePaging } from '../../hooks/paging/usePaging';
import { useEntityRules } from '../../hooks/useEntityRules';
import { useFqn } from '../../hooks/useFqn';
import {
  DataQualityPageTabs,
  DataQualitySubTabs,
} from '../../pages/DataQuality/DataQualityPage.interface';
import { getIngestionPipelines } from '../../rest/ingestionPipelineAPI';
import {
  addTestCaseToLogicalTestSuite,
  getListTestCaseBySearch,
  getTestSuiteByName,
  ListTestCaseParamsBySearch,
  updateTestSuiteById,
} from '../../rest/testAPI';
import { getEntityName } from '../../utils/EntityUtils';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../utils/PermissionsUtils';
import {
  getDataQualityPagePath,
  getTestSuitePath,
} from '../../utils/RouterUtils';
import { ExtraTestCaseDropdownOptions } from '../../utils/TestCaseUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './test-suite-details-page.less';

const TestSuiteDetailsPage = () => {
  const { t } = useTranslation();
  const { entityRules } = useEntityRules(EntityType.TEST_SUITE);
  const { getEntityPermissionByFqn, permissions: globalPermissions } =
    usePermissionProvider();
  const { fqn: testSuiteFQN } = useFqn();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(EntityTabs.TEST_CASES);
  const { showModal } = useEntityExportModalProvider();

  const afterDeleteAction = () => {
    navigate(getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES));
  };
  const [testSuite, setTestSuite] = useState<TestSuite>();

  const [isTestCaseLoading, setIsTestCaseLoading] = useState(true);
  const [testCaseResult, setTestCaseResult] = useState<Array<TestCase>>([]);

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
        url: getDataQualityPagePath(
          DataQualityPageTabs.TEST_SUITES,
          DataQualitySubTabs.BUNDLE_SUITES
        ),
      },
      {
        name: getEntityName(testSuite),
        url: getTestSuitePath(testSuite?.fullyQualifiedName ?? ''),
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

  const fetchTestCases = async (param?: ListTestCaseParamsBySearch) => {
    setIsTestCaseLoading(true);
    try {
      const response = await getListTestCaseBySearch({
        fields: [
          TabSpecificField.TEST_CASE_RESULT,
          TabSpecificField.TEST_DEFINITION,
          TabSpecificField.TESTSUITE,
          TabSpecificField.INCIDENT_ID,
        ],
        testSuiteId,
        ...sortOptions,
        ...param,
        limit: pageSize,
      });
      const { paging: ingestionPipelinePaging } = await getIngestionPipelines({
        arrQueryFields: [],
        testSuite: testSuiteFQN,
        pipelineType: [PipelineType.TestSuite],
        limit: 0,
      });
      setIngestionPipelineCount(ingestionPipelinePaging.total);
      setTestCaseResult(response.data);
      handlePagingChange(response.paging);
    } catch {
      setTestCaseResult([]);
      showErrorToast(
        t('server.entity-fetch-error', {
          entity: t('label.test-case-plural'),
        })
      );
    } finally {
      setIsTestCaseLoading(false);
    }
  };
  const handleSortTestCase = async (apiParams?: ListTestCaseParamsBySearch) => {
    setSortOptions(apiParams ?? DEFAULT_SORT_ORDER);
    await fetchTestCases({ ...(apiParams ?? DEFAULT_SORT_ORDER), offset: 0 });
    handlePageChange(INITIAL_PAGING_VALUE);
  };

  const handleAddTestCaseSubmit = async (testCases: TestCase[]) => {
    const testCaseIds = testCases.reduce((ids, curr) => {
      return curr.id ? [...ids, curr.id] : ids;
    }, [] as string[]);
    try {
      await addTestCaseToLogicalTestSuite({
        testCaseIds,
        testSuiteId,
      });
      setIsTestCaseModalOpen(false);
      fetchTestCases();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchTestSuiteByName = async () => {
    try {
      const response = await getTestSuiteByName(testSuiteFQN, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.DOMAINS],
        include: Include.All,
      });
      setSlashedBreadCrumb([
        {
          name: t('label.test-suite-plural'),
          url: getDataQualityPagePath(
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
    } catch (error) {
      setTestSuite(undefined);
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.test-suite'),
        })
      );
    }
  };

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
      const updatedTestSuite = {
        ...testSuite,
        owners: updatedOwners,
      } as TestSuite;

      await updateTestSuiteData(updatedTestSuite);
    },
    [testSuite]
  );

  const handleDomainUpdate = useCallback(
    async (updateDomain?: EntityReference | EntityReference[]) => {
      let domains: EntityReference[];
      if (isArray(updateDomain)) {
        domains = updateDomain;
      } else if (isEmpty(updateDomain)) {
        domains = [];
      } else {
        domains = [updateDomain as EntityReference];
      }

      const updatedTestSuite: TestSuite = {
        ...testSuite,
        domains,
      } as TestSuite;

      await updateTestSuiteData(updatedTestSuite);
    },
    [testSuite]
  );

  const onDescriptionUpdate = useCallback(
    async (updatedHTML: string) => {
      if (testSuite?.description !== updatedHTML) {
        const updatedTestSuite = { ...testSuite, description: updatedHTML };
        try {
          const response = await saveAndUpdateTestSuiteData(
            updatedTestSuite as TestSuite
          );
          if (response) {
            setTestSuite(response);
          } else {
            throw t('server.unexpected-response');
          }
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [testSuite, t]
  );

  const handleDisplayNameChange = async (entityName?: EntityName) => {
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
  };

  const handleTestCasePaging = ({ currentPage }: PagingHandlerParams) => {
    if (currentPage) {
      handlePageChange(currentPage);
      fetchTestCases({
        offset: (currentPage - 1) * pageSize,
      });
    }
  };

  const handleTestSuiteUpdate = (testCase?: TestCase) => {
    if (testCase) {
      setTestCaseResult((prev) =>
        prev.map((test) =>
          test.id === testCase.id ? { ...test, ...testCase } : test
        )
      );
    }
  };

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
  }, [testSuite, pageSize]);

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

  const tabs = useMemo(() => {
    const removeFromTestSuite = testSuite
      ? {
          testSuite,
          isAllowed:
            testSuitePermissions.EditAll || testSuitePermissions.EditTests,
        }
      : undefined;

    const renderDescription = () => (
      <div className="tw:w-full">
        <DescriptionV1
          wrapInCard
          description={testSuiteDescription}
          entityName={getEntityName(testSuite)}
          entityType={EntityType.TEST_SUITE}
          hasEditAccess={permissions.hasEditDescriptionPermission}
          showCommentsIcon={false}
          onDescriptionUpdate={onDescriptionUpdate}
        />
      </div>
    );

    return {
      testCasesTab: {
        label: (
          <TabsLabel
            count={pagingData.paging.total}
            id={EntityTabs.TEST_CASES}
            name={t('label.test-case-plural')}
          />
        ),
        key: EntityTabs.TEST_CASES,
        children: (
          <div className="tw:flex tw:w-full tw:flex-col tw:gap-4 tw:rounded-[10px] tw:border tw:border-gray-200 tw:bg-white tw:p-4">
            {renderDescription()}
            <div className="tw:w-full">
              <DataQualityTab
                afterDeleteAction={fetchTestCases}
                breadcrumbData={incidentUrlState}
                fetchTestCases={handleSortTestCase}
                isLoading={isLoading || isTestCaseLoading}
                pagingData={pagingData}
                removeFromTestSuite={removeFromTestSuite}
                showPagination={showPagination}
                testCases={testCaseResult}
                onTestCaseResultUpdate={handleTestSuiteUpdate}
                onTestUpdate={handleTestSuiteUpdate}
              />
            </div>
          </div>
        ),
      },
      pipelineTab: {
        label: (
          <TabsLabel
            count={ingestionPipelineCount}
            id={EntityTabs.PIPELINE}
            name={t('label.pipeline-plural')}
          />
        ),
        key: EntityTabs.PIPELINE,
        children: (
          <div className="tw:flex tw:w-full tw:flex-col tw:gap-4 tw:rounded-[10px] tw:border tw:border-gray-200 tw:bg-white tw:p-4">
            {renderDescription()}
            <div className="tw:w-full">
              <TestSuitePipelineTab isLogicalTestSuite testSuite={testSuite} />
            </div>
          </div>
        ),
      },
    };
  }, [
    testSuite,
    incidentUrlState,
    isLoading,
    isTestCaseLoading,
    pagingData,
    showPagination,
    testCaseResult,
    handleTestSuiteUpdate,
    handleSortTestCase,
    fetchTestCases,
    ingestionPipelineCount,
    testSuitePermissions,
    testSuiteDescription,
    permissions.hasEditDescriptionPermission,
    onDescriptionUpdate,
    t,
  ]);

  const selectedTestCases = useMemo(() => {
    return testCaseResult.map((test) => test.name);
  }, [testCaseResult]);

  if (isLoading) {
    return <Loader />;
  }

  if (!testSuitePermissions.ViewAll && !testSuitePermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.test-suite'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(testSuite),
      })}>
      <div className="page-container tw:flex tw:w-full tw:flex-col">
        <div className="tw:w-full">
          <TitleBreadcrumb
            data-testid="test-suite-breadcrumb"
            titleLinks={slashedBreadCrumb}
          />
        </div>
        <div className="tw:w-full">
          <div className="tw:mb-2 tw:flex tw:items-center tw:justify-between tw:gap-4">
            <div className="tw:min-w-0 tw:flex-1">
              <EntityHeaderTitle
                className="w-max-full-45"
                displayName={testSuite?.displayName}
                icon={<TestSuiteIcon className="h-9" />}
                name={testSuite?.name ?? ''}
                serviceName="testSuite"
                suffix={<LearningIcon pageId={LEARNING_PAGE_IDS.TEST_SUITE} />}
              />
            </div>
            <div className="tw:flex tw:items-center tw:gap-1">
              {(testSuitePermissions.EditAll ||
                testSuitePermissions.EditTests) && (
                <Button
                  color="primary"
                  data-testid="add-test-case-btn"
                  size="md"
                  onPress={() => setIsTestCaseModalOpen(true)}>
                  {t('label.add-entity', {
                    entity: t('label.test-case-plural'),
                  })}
                </Button>
              )}
              <ManageButton
                isRecursiveDelete
                afterDeleteAction={afterDeleteAction}
                allowSoftDelete={false}
                canDelete={permissions.hasDeletePermission}
                deleted={testSuite?.deleted}
                displayName={getEntityName(testSuite)}
                editDisplayNamePermission={
                  testSuitePermissions.EditAll ||
                  testSuitePermissions.EditDisplayName
                }
                entityId={testSuite?.id}
                entityName={testSuite?.fullyQualifiedName as string}
                entityType={EntityType.TEST_SUITE}
                extraDropdownContent={extraDropdownContent}
                onEditDisplayName={handleDisplayNameChange}
              />
            </div>
          </div>

          <div className="test-suite-details-domain-owner-section tw:mt-3 tw:flex tw:flex-wrap tw:gap-4 tw:rounded-[12px] tw:border tw:border-gray-200 tw:bg-white tw:p-4 tw:sm:p-5">
            <DomainLabel
              headerLayout
              showDashPlaceholder
              domains={testSuite?.domains}
              entityFqn={testSuite?.fullyQualifiedName ?? ''}
              entityId={testSuite?.id ?? ''}
              entityType={EntityType.TEST_SUITE}
              hasPermission={testSuitePermissions.EditAll}
              multiple={entityRules.canAddMultipleDomains}
              onUpdate={handleDomainUpdate}
            />
            <div
              aria-hidden
              className="tw:h-[50px] tw:w-px tw:self-center tw:bg-border-primary"
            />
            <OwnerLabel
              hasPermission={permissions.hasEditOwnerPermission}
              isCompactView={false}
              multiple={{
                user: entityRules.canAddMultipleUserOwners,
                team: entityRules.canAddMultipleTeamOwner,
              }}
              owners={testOwners}
              onUpdate={onUpdateOwner}
            />
          </div>
        </div>
        <div
          className="test-suite-details-tabs-root tw:mt-3 tw:w-full tw:flex tw:flex-col"
          data-testid="tabs-root">
          <Tabs
            className="test-suite-details-tabs tw:bg-transparent"
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}>
            <Tabs.List
              items={[
                { id: EntityTabs.TEST_CASES, label: tabs.testCasesTab.label },
                { id: EntityTabs.PIPELINE, label: tabs.pipelineTab.label },
              ]}
              type="underline"
            />
            <Tabs.Panel id={EntityTabs.TEST_CASES}>
              {tabs.testCasesTab.children}
            </Tabs.Panel>
            <Tabs.Panel id={EntityTabs.PIPELINE}>
              {tabs.pipelineTab.children}
            </Tabs.Panel>
          </Tabs>
        </div>
        <div className="tw:w-full">
          <ModalOverlay
            isOpen={isTestCaseModalOpen}
            onOpenChange={setIsTestCaseModalOpen}>
            <Modal className="tw:max-w-2xl tw:rounded-xl">
              <Dialog className="tw:flex tw:max-h-[90vh] tw:w-full tw:flex-col tw:overflow-hidden tw:rounded-xl tw:bg-background-paper tw:p-6">
                <Typography
                  as="h2"
                  className="tw:mb-4 tw:text-lg tw:font-semibold tw:text-body">
                  {t('label.add-entity', {
                    entity: t('label.test-case-plural'),
                  })}
                </Typography>
                <div className="tw:flex-1 tw:overflow-y-auto">
                  <AddTestCaseList
                    existingTest={testSuite?.tests ?? []}
                    selectedTest={selectedTestCases}
                    onCancel={() => setIsTestCaseModalOpen(false)}
                    onSubmit={handleAddTestCaseSubmit}
                  />
                </div>
              </Dialog>
            </Modal>
          </ModalOverlay>
        </div>
      </div>
    </PageLayoutV1>
  );
};

export default TestSuiteDetailsPage;
