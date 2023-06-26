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

import { Button, Col, Row, Space } from 'antd';
import { AxiosError } from 'axios';
import { AddTestCaseModal } from 'components/AddTestCaseModal/AddTestCaseModal.component';
import { useAuthContext } from 'components/authentication/auth-provider/AuthProvider';
import Description from 'components/common/description/Description';
import ManageButton from 'components/common/entityPageInfo/ManageButton/ManageButton';
import EntitySummaryDetails from 'components/common/EntitySummaryDetails/EntitySummaryDetails';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import DataQualityTab from 'components/ProfilerDashboard/component/DataQualityTab';
import { EntityInfo } from 'enums/entity.enum';
import { compare } from 'fast-json-patch';
import { useAuth } from 'hooks/authHooks';
import { ExtraInfo } from 'Models';
import { DataQualityPageTabs } from 'pages/DataQuality/DataQualityPage.interface';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  getListTestCase,
  getTestSuiteByName,
  ListTestCaseParams,
  updateTestSuiteById,
} from 'rest/testAPI';
import { getEntityName } from 'utils/EntityUtils';
import { getDataQualityPagePath } from 'utils/RouterUtils';
import {
  getTeamAndUserDetailsPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { ACTION_TYPE, ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { OwnerType } from '../../enums/user.enum';
import { TestCase } from '../../generated/tests/testCase';
import { TestSuite } from '../../generated/tests/testSuite';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { getEntityPlaceHolder } from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './TestSuiteDetailsPage.styles.less';

const TestSuiteDetailsPage = () => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { testSuiteFQN } = useParams<Record<string, string>>();
  const { isAdminUser } = useAuth();
  const history = useHistory();
  const { isAuthDisabled } = useAuthContext();

  const hasAccess = isAdminUser || isAuthDisabled;

  const afterDeleteAction = () => {
    history.push(getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES));
  };
  const [testSuite, setTestSuite] = useState<TestSuite>();
  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [isTestCaseLoading, setIsTestCaseLoading] = useState(false);
  const [testCaseResult, setTestCaseResult] = useState<Array<TestCase>>([]);
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);
  const [testCasesPaging, setTestCasesPaging] = useState<Paging>(pagingObject);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testSuitePermissions, setTestSuitePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] =
    useState<boolean>(false);

  const [slashedBreadCrumb, setSlashedBreadCrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

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
      showErrorToast(
        t('server.entity-fetch-error', {
          entity: t('label.test-case-plural'),
        })
      );
    } finally {
      setIsTestCaseLoading(false);
    }
  };

  const afterSubmitAction = () => {
    fetchTestCases();
  };

  const fetchTestSuiteByName = async () => {
    try {
      const response = await getTestSuiteByName(testSuiteFQN, {
        fields: 'owner,tests',
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
      fetchTestCases({ testSuiteId: response.id });
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

  const updateTestSuiteData = (updatedTestSuite: TestSuite, type: string) => {
    saveAndUpdateTestSuiteData(updatedTestSuite)
      .then((res) => {
        if (res) {
          setTestSuite(res);
        } else {
          showErrorToast(t('server.unexpected-response'));
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t(
            `server.entity-${
              type === ACTION_TYPE.UPDATE ? 'updating' : 'removing'
            }-error`,
            {
              entity: t('label.owner'),
            }
          )
        );
      });
  };

  const onUpdateOwner = useCallback(
    (updatedOwner: TestSuite['owner']) => {
      const updatedTestSuite = {
        ...testSuite,
        owner: updatedOwner
          ? {
              ...testOwner,
              ...updatedOwner,
            }
          : undefined,
      } as TestSuite;

      updateTestSuiteData(updatedTestSuite, ACTION_TYPE.UPDATE);
    },
    [testOwner, testSuite]
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
      } finally {
        descriptionHandler(false);
      }
    } else {
      descriptionHandler(false);
    }
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
        key: EntityInfo.OWNER,
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

  if (!testSuitePermissions.ViewAll && !testSuitePermissions.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(testSuite),
      })}>
      <Row className="page-container" gutter={[16, 32]}>
        <Col span={24}>
          <Space align="center" className="justify-between w-full">
            <TitleBreadcrumb
              data-testid="test-suite-breadcrumb"
              titleLinks={slashedBreadCrumb}
            />
            <Space>
              <Button
                type="primary"
                onClick={() => setIsTestCaseModalOpen(true)}>
                {t('label.add-entity', { entity: t('label.test-case-plural') })}
              </Button>
              <ManageButton
                isRecursiveDelete
                afterDeleteAction={afterDeleteAction}
                allowSoftDelete={false}
                canDelete={hasAccess}
                deleted={testSuite?.deleted}
                entityId={testSuite?.id}
                entityName={testSuite?.fullyQualifiedName as string}
                entityType="testSuite"
              />
            </Space>
          </Space>

          <div className="d-flex tw-gap-1 tw-mb-2 tw-mt-1 flex-wrap">
            {extraInfo.map((info) => (
              <span className="d-flex" data-testid={info.key} key={info.key}>
                <EntitySummaryDetails
                  currentOwner={testSuite?.owner}
                  data={info}
                  updateOwner={hasAccess ? onUpdateOwner : undefined}
                />
              </span>
            ))}
          </div>

          <Space>
            <Description
              className="test-suite-description"
              description={testSuiteDescription || ''}
              entityName={testSuite?.displayName ?? testSuite?.name}
              hasEditAccess={hasAccess}
              isEdit={isDescriptionEditable}
              onCancel={() => descriptionHandler(false)}
              onDescriptionEdit={() => descriptionHandler(true)}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </Space>
        </Col>
        <Col span={24}>
          <DataQualityTab
            isLoading={isTestCaseLoading}
            pagingData={{
              currentPage,
              paging: testCasesPaging,
              onPagingClick: handleTestCasePaging,
            }}
            removeFromTestSuite={{ testSuite: testSuite as TestSuite }}
            testCases={testCaseResult}
            onTestUpdate={afterSubmitAction}
          />
        </Col>
        <Col span={24}>
          <AddTestCaseModal
            existingTest={testSuite?.tests ?? []}
            open={isTestCaseModalOpen}
            testSuiteId={testSuite?.id ?? ''}
            onCancel={() => setIsTestCaseModalOpen(false)}
            onSubmit={afterSubmitAction}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default TestSuiteDetailsPage;
