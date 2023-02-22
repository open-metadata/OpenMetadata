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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import TabsPane from 'components/common/TabsPane/TabsPane';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TestCasesTab from 'components/TestCasesTab/TestCasesTab.component';
import TestSuiteDetails from 'components/TestSuiteDetails/TestSuiteDetails.component';
import TestSuitePipelineTab from 'components/TestSuitePipelineTab/TestSuitePipelineTab.component';
import { compare } from 'fast-json-patch';
import { camelCase, startCase } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  getListTestCase,
  getTestSuiteByName,
  ListTestCaseParams,
  updateTestSuiteById,
} from 'rest/testAPI';
import {
  getTeamAndUserDetailsPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  pagingObject,
  ROUTES,
} from '../../constants/constants';
import { NO_PERMISSION_TO_VIEW } from '../../constants/HelperTextUtil';
import { ACTION_TYPE } from '../../enums/common.enum';
import { OwnerType } from '../../enums/user.enum';
import { TestCase } from '../../generated/tests/testCase';
import { TestSuite } from '../../generated/tests/testSuite';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import jsonData from '../../jsons/en';
import { getEntityName, getEntityPlaceHolder } from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './TestSuiteDetailsPage.styles.less';

const TestSuiteDetailsPage = () => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { testSuiteFQN } = useParams<Record<string, string>>();
  const [testSuite, setTestSuite] = useState<TestSuite>();
  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [isDeleteWidgetVisible, setIsDeleteWidgetVisible] = useState(false);
  const [isTestCaseLoading, setIsTestCaseLoading] = useState(false);
  const [testCaseResult, setTestCaseResult] = useState<Array<TestCase>>([]);
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);
  const [testCasesPaging, setTestCasesPaging] = useState<Paging>(pagingObject);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testSuitePermissions, setTestSuitePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [slashedBreadCrumb, setSlashedBreadCrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const [activeTab, setActiveTab] = useState<number>(1);

  const tabs = [
    {
      name: t('label.test-case-plural'),
      isProtected: false,
      position: 1,
    },
    {
      name: t('label.pipeline'),
      isProtected: false,
      position: 2,
    },
  ];

  const { testSuiteDescription, testSuiteId, testOwner } = useMemo(() => {
    return {
      testOwner: testSuite?.owner,
      testSuiteId: testSuite?.id,
      testSuiteDescription: testSuite?.description,
    };
  }, [testSuite]);

  const saveAndUpdateTestSuiteData = (updatedData: TestSuite) => {
    const jsonPatch = compare(testSuite as TestSuite, updatedData);

    return updateTestSuiteById(testSuiteId as string, jsonPatch);
  };

  const descriptionHandler = (value: boolean) => {
    setIsDescriptionEditable(value);
  };

  const fetchTestSuitePermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.TEST_SUITE,
        testSuiteFQN
      );
      setTestSuitePermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTestCases = async (param?: ListTestCaseParams, limit?: number) => {
    setIsTestCaseLoading(true);
    try {
      const response = await getListTestCase({
        fields: 'testCaseResult,testDefinition,testSuite',
        testSuiteId: testSuiteId,
        limit: limit || PAGE_SIZE,
        before: param && param.before,
        after: param && param.after,
        ...param,
      });

      setTestCaseResult(response.data);
      setTestCasesPaging(response.paging);
    } catch {
      setTestCaseResult([]);
      showErrorToast(jsonData['api-error-messages']['fetch-test-cases-error']);
    } finally {
      setIsTestCaseLoading(false);
    }
  };

  const afterSubmitAction = (deletedTest = false) => {
    fetchTestCases({
      include: deletedTest ? Include.Deleted : Include.NonDeleted,
    });
  };

  const fetchTestSuiteByName = async () => {
    try {
      const response = await getTestSuiteByName(testSuiteFQN, {
        fields: 'owner',
      });
      setSlashedBreadCrumb([
        {
          name: t('label.test-suite-plural'),
          url: ROUTES.TEST_SUITES,
        },
        {
          name: startCase(
            camelCase(response?.fullyQualifiedName || response?.name)
          ),
          url: '',
        },
      ]);
      setTestSuite(response);
      fetchTestCases({ testSuiteId: response.id });
    } catch (error) {
      setTestSuite(undefined);
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-test-suite-error']
      );
    }
  };

  const updateTestSuiteData = (updatedTestSuite: TestSuite, type: string) => {
    saveAndUpdateTestSuiteData(updatedTestSuite)
      .then((res) => {
        if (res) {
          setTestSuite(res);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['unexpected-server-response']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages'][
            type === ACTION_TYPE.UPDATE
              ? 'update-owner-error'
              : 'remove-owner-error'
          ]
        );
      });
  };

  const onUpdateOwner = (updatedOwner: TestSuite['owner']) => {
    if (updatedOwner) {
      const updatedTestSuite = {
        ...testSuite,
        owner: {
          ...testSuite?.owner,
          ...updatedOwner,
        },
      } as TestSuite;

      updateTestSuiteData(updatedTestSuite, ACTION_TYPE.UPDATE);
    }
  };

  const onRemoveOwner = () => {
    if (testSuite) {
      const updatedTestSuite = {
        ...testSuite,
        owner: undefined,
      } as TestSuite;

      updateTestSuiteData(updatedTestSuite, ACTION_TYPE.REMOVE);
    }
  };

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
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        descriptionHandler(false);
      }
    } else {
      descriptionHandler(false);
    }
  };

  const onSetActiveValue = (tabValue: number) => {
    setActiveTab(tabValue);
  };

  const handleDeleteWidgetVisible = (isVisible: boolean) => {
    setIsDeleteWidgetVisible(isVisible);
  };

  const handleTestCasePaging = (
    cursorValue: string | number,
    activePage?: number | undefined
  ) => {
    setCurrentPage(activePage as number);
    fetchTestCases({
      [cursorValue]: testCasesPaging[cursorValue as keyof Paging] as string,
    });
  };

  const extraInfo: Array<ExtraInfo> = useMemo(
    () => [
      {
        key: t('label.owner'),
        value:
          testOwner?.type === 'team'
            ? getTeamAndUserDetailsPath(testOwner?.name || '')
            : getEntityName(testOwner) || '',
        placeholderText:
          getEntityPlaceHolder(
            (testOwner?.displayName as string) || (testOwner?.name as string),
            testOwner?.deleted
          ) || '',
        isLink: testOwner?.type === 'team',
        openInNewTab: false,
        profileName:
          testOwner?.type === OwnerType.USER ? testOwner?.name : undefined,
      },
    ],
    [testOwner]
  );

  useEffect(() => {
    if (testSuitePermissions.ViewAll || testSuitePermissions.ViewBasic) {
      fetchTestSuiteByName();
    }
  }, [testSuitePermissions, testSuiteFQN]);

  useEffect(() => {
    fetchTestSuitePermission();
  }, [testSuiteFQN]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      {testSuitePermissions.ViewAll || testSuitePermissions.ViewBasic ? (
        <PageContainerV1>
          <Row className="tw-pt-4 tw-px-6 tw-w-full">
            <Col span={24}>
              <TestSuiteDetails
                descriptionHandler={descriptionHandler}
                extraInfo={extraInfo}
                handleDeleteWidgetVisible={handleDeleteWidgetVisible}
                handleDescriptionUpdate={onDescriptionUpdate}
                handleRemoveOwner={onRemoveOwner}
                handleUpdateOwner={onUpdateOwner}
                isDeleteWidgetVisible={isDeleteWidgetVisible}
                isDescriptionEditable={isDescriptionEditable}
                permissions={testSuitePermissions}
                slashedBreadCrumb={slashedBreadCrumb}
                testSuite={testSuite}
                testSuiteDescription={testSuiteDescription}
              />
            </Col>
            <Col className="tw-mt-8" span={24}>
              <TabsPane
                activeTab={activeTab}
                setActiveTab={onSetActiveValue}
                tabs={tabs}
              />
              <div className="tw-mb-4">
                {activeTab === 1 && (
                  <TestCasesTab
                    currentPage={currentPage}
                    isDataLoading={isTestCaseLoading}
                    testCasePageHandler={handleTestCasePaging}
                    testCases={testCaseResult}
                    testCasesPaging={testCasesPaging}
                    onTestUpdate={afterSubmitAction}
                  />
                )}
                {activeTab === 2 && <TestSuitePipelineTab />}
              </div>
            </Col>
          </Row>
        </PageContainerV1>
      ) : (
        <ErrorPlaceHolder>{NO_PERMISSION_TO_VIEW}</ErrorPlaceHolder>
      )}
    </>
  );
};

export default TestSuiteDetailsPage;
