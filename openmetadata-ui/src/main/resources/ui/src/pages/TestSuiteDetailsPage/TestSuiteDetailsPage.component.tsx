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
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Tab,
  Tabs,
  useTheme,
} from '@mui/material';
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

const TestSuiteDetailsPage = () => {
  const { t } = useTranslation();
  const theme = useTheme();
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
      const updatedTestSuite: TestSuite = {
        ...testSuite,
        domains: isArray(updateDomain)
          ? updateDomain
          : isEmpty(updateDomain)
          ? []
          : [updateDomain],
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
      <Box sx={{ width: '100%' }}>
        <DescriptionV1
          wrapInCard
          description={testSuiteDescription}
          entityName={getEntityName(testSuite)}
          entityType={EntityType.TEST_SUITE}
          hasEditAccess={permissions.hasEditDescriptionPermission}
          showCommentsIcon={false}
          onDescriptionUpdate={onDescriptionUpdate}
        />
      </Box>
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
          <Stack
            spacing={4}
            sx={{
              border: `1px solid ${theme.palette.grey[200]}`,
              borderRadius: 1.25,
              background: theme.palette.background.paper,
              p: 4,
            }}>
            {renderDescription()}
            <Box sx={{ width: '100%' }}>
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
            </Box>
          </Stack>
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
          <Stack
            spacing={4}
            sx={{
              border: `1px solid ${theme.palette.grey[200]}`,
              borderRadius: 1.25,
              background: theme.palette.background.paper,
              p: 4,
            }}>
            {renderDescription()}
            <Box sx={{ width: '100%' }}>
              <TestSuitePipelineTab isLogicalTestSuite testSuite={testSuite} />
            </Box>
          </Stack>
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
    theme,
    t,
  ]);

  const selectedTestCases = useMemo(() => {
    return testCaseResult.map((test) => test.name);
  }, [testCaseResult]);

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: string) => {
      setActiveTab(newValue);
    },
    []
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
      <Stack className="page-container" spacing={4}>
        <Box sx={{ width: '100%' }}>
          <TitleBreadcrumb
            data-testid="test-suite-breadcrumb"
            titleLinks={slashedBreadCrumb}
          />
        </Box>
        <Box sx={{ width: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
              mb: 2,
            }}>
            <Box sx={{ flex: '1 1 0%', minWidth: 0 }}>
              <EntityHeaderTitle
                className="w-max-full-45"
                displayName={testSuite?.displayName}
                icon={<TestSuiteIcon className="h-9" />}
                name={testSuite?.name ?? ''}
                serviceName="testSuite"
                suffix={<LearningIcon pageId={LEARNING_PAGE_IDS.TEST_SUITE} />}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {(testSuitePermissions.EditAll ||
                testSuitePermissions.EditTests) && (
                <Button
                  data-testid="add-test-case-btn"
                  variant="contained"
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
                extraDropdownContent={extraDropdownContent}
                onEditDisplayName={handleDisplayNameChange}
              />
            </Box>
          </Box>

          <Box
            sx={{
              borderRadius: 1.5,
              border: `1px solid ${theme.palette.grey[200]}`,
              padding: `${theme.spacing(4)} ${theme.spacing(5)}`,
              gap: 4,
              display: 'flex',
              backgroundColor: theme.palette.background.paper,
              flexWrap: 'wrap',
              mt: 3,
            }}>
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
            <Divider
              orientation="vertical"
              sx={{
                alignSelf: 'center',
                height: '50px',
              }}
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
          </Box>
        </Box>
        <Box sx={{ width: '100%', mt: 3 }}>
          <Tabs
            sx={{ background: 'none' }}
            value={activeTab}
            onChange={handleTabChange}>
            <Tab
              label={tabs.testCasesTab.label}
              value={EntityTabs.TEST_CASES}
            />
            <Tab label={tabs.pipelineTab.label} value={EntityTabs.PIPELINE} />
          </Tabs>
          <Box
            sx={{
              mt: 3,
            }}>
            {activeTab === EntityTabs.TEST_CASES && tabs.testCasesTab.children}
            {activeTab === EntityTabs.PIPELINE && tabs.pipelineTab.children}
          </Box>
        </Box>
        <Box sx={{ width: '100%' }}>
          <Dialog
            fullWidth
            maxWidth="md"
            open={isTestCaseModalOpen}
            slotProps={{
              paper: {
                sx: {
                  borderRadius: 2,
                },
              },
            }}
            onClose={() => setIsTestCaseModalOpen(false)}>
            <DialogTitle>
              {t('label.add-entity', {
                entity: t('label.test-case-plural'),
              })}
            </DialogTitle>
            <DialogContent>
              <AddTestCaseList
                existingTest={testSuite?.tests ?? []}
                selectedTest={selectedTestCases}
                onCancel={() => setIsTestCaseModalOpen(false)}
                onSubmit={handleAddTestCaseSubmit}
              />
            </DialogContent>
          </Dialog>
        </Box>
      </Stack>
    </PageLayoutV1>
  );
};

export default TestSuiteDetailsPage;
