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

import { Button, Col, Divider, Modal, Row, Space, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
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
import EntityHeaderTitle from '../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { INITIAL_PAGING_VALUE } from '../../constants/constants';
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
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCase } from '../../generated/tests/testCase';
import { EntityReference, TestSuite } from '../../generated/tests/testSuite';
import { Include } from '../../generated/type/include';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import { DataQualityPageTabs } from '../../pages/DataQuality/DataQualityPage.interface';
import { getIngestionPipelines } from '../../rest/ingestionPipelineAPI';
import {
  addTestCaseToLogicalTestSuite,
  getListTestCaseBySearch,
  getTestSuiteByName,
  ListTestCaseParamsBySearch,
  updateTestSuiteById,
} from '../../rest/testAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  getDataQualityPagePath,
  getTestSuitePath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './test-suite-details-page.styles.less';

const TestSuiteDetailsPage = () => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { fqn: testSuiteFQN } = useFqn();
  const navigate = useNavigate();

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

  const incidentUrlState = useMemo(() => {
    return [
      {
        name: t('label.test-suite-plural'),
        url: getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES),
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
          url: getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES),
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
    [testOwners, testSuite]
  );

  const handleDomainUpdate = useCallback(
    async (updateDomain?: EntityReference | EntityReference[]) => {
      const updatedTestSuite: TestSuite = {
        ...testSuite,
        domain: updateDomain,
      } as TestSuite;

      await updateTestSuiteData(updatedTestSuite);
    },
    [testOwners, testSuite]
  );

  const onDescriptionUpdate = async (updatedHTML: string) => {
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
  };

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

  const tabs = useMemo(
    () => [
      {
        label: (
          <TabsLabel
            count={pagingData.paging.total}
            id={EntityTabs.TEST_CASES}
            name={t('label.test-case-plural')}
          />
        ),
        key: EntityTabs.TEST_CASES,
        children: (
          <DataQualityTab
            afterDeleteAction={fetchTestCases}
            breadcrumbData={incidentUrlState}
            fetchTestCases={handleSortTestCase}
            isLoading={isLoading || isTestCaseLoading}
            pagingData={pagingData}
            removeFromTestSuite={testSuite ? { testSuite } : undefined}
            showPagination={showPagination}
            testCases={testCaseResult}
            onTestCaseResultUpdate={handleTestSuiteUpdate}
            onTestUpdate={handleTestSuiteUpdate}
          />
        ),
      },
      {
        label: (
          <TabsLabel
            count={ingestionPipelineCount}
            id={EntityTabs.PIPELINE}
            name={t('label.pipeline-plural')}
          />
        ),
        key: EntityTabs.PIPELINE,
        children: (
          <TestSuitePipelineTab isLogicalTestSuite testSuite={testSuite} />
        ),
      },
    ],
    [
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
    ]
  );

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
      <Row className="page-container" gutter={[0, 24]}>
        <Col span={24}>
          <TitleBreadcrumb
            data-testid="test-suite-breadcrumb"
            titleLinks={slashedBreadCrumb}
          />
        </Col>
        <Col span={24}>
          <Row gutter={[16, 16]}>
            <Col span={18}>
              <EntityHeaderTitle
                className="w-max-full-45"
                displayName={testSuite?.displayName}
                icon={<TestSuiteIcon className="h-9" />}
                name={testSuite?.name ?? ''}
                serviceName="testSuite"
              />
            </Col>
            <Col className="d-flex justify-end" span={6}>
              <Space>
                {(testSuitePermissions.EditAll ||
                  testSuitePermissions.EditTests) && (
                  <Button
                    data-testid="add-test-case-btn"
                    type="primary"
                    onClick={() => setIsTestCaseModalOpen(true)}>
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
                  onEditDisplayName={handleDisplayNameChange}
                />
              </Space>
            </Col>

            <Col span={24}>
              <div className="d-flex flex-wrap gap-2">
                <DomainLabel
                  domains={testSuite?.domains}
                  entityFqn={testSuite?.fullyQualifiedName ?? ''}
                  entityId={testSuite?.id ?? ''}
                  entityType={EntityType.TEST_SUITE}
                  hasPermission={testSuitePermissions.EditAll}
                  onUpdate={handleDomainUpdate}
                />
                <Divider className="self-center" type="vertical" />
                <OwnerLabel
                  hasPermission={permissions.hasEditOwnerPermission}
                  owners={testOwners}
                  onUpdate={onUpdateOwner}
                />
              </div>
            </Col>
          </Row>
        </Col>

        <Col span={24}>
          <DescriptionV1
            className="test-suite-description"
            description={testSuiteDescription}
            entityName={getEntityName(testSuite)}
            entityType={EntityType.TEST_SUITE}
            hasEditAccess={permissions.hasEditDescriptionPermission}
            showCommentsIcon={false}
            onDescriptionUpdate={onDescriptionUpdate}
          />
        </Col>

        <Col span={24}>
          <Tabs className="tabs-new" items={tabs} />
        </Col>
        <Col span={24}>
          <Modal
            centered
            destroyOnClose
            closable={false}
            footer={null}
            open={isTestCaseModalOpen}
            title={t('label.add-entity', {
              entity: t('label.test-case-plural'),
            })}
            width={750}>
            <AddTestCaseList
              existingTest={testSuite?.tests ?? []}
              onCancel={() => setIsTestCaseModalOpen(false)}
              onSubmit={handleAddTestCaseSubmit}
            />
          </Modal>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default TestSuiteDetailsPage;
