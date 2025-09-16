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
import Icon from '@ant-design/icons';
import { Button, Col, Row, Tabs, TabsProps, Tooltip, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare, Operation as PatchOperation } from 'fast-json-patch';
import { isUndefined, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as TestCaseIcon } from '../../../assets/svg/ic-checklist.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { withActivityFeed } from '../../../components/AppRouter/withActivityFeed';
import ManageButton from '../../../components/common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AlignRightIconButton } from '../../../components/common/IconButtons/EditIconButton';
import Loader from '../../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import IncidentManagerPageHeader from '../../../components/DataQuality/IncidentManager/IncidentManagerPageHeader/IncidentManagerPageHeader.component';
import EntityHeaderTitle from '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import EntityVersionTimeLine from '../../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import { EntityName } from '../../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  ChangeDescription,
  EntityReference,
} from '../../../generated/tests/testCase';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import {
  getTestCaseByFqn,
  getTestCaseVersionDetails,
  getTestCaseVersionList,
  updateTestCaseById,
} from '../../../rest/testAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import {
  getTestCaseDetailPagePath,
  getTestCaseVersionPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { TestCasePageTabs } from '../IncidentManager.interface';
import './incident-manager-details.less';
import testCaseClassBase from './TestCaseClassBase';
import { useTestCaseStore } from './useTestCase.store';

const IncidentManagerDetailPage = ({
  isVersionPage = false,
}: {
  isVersionPage?: boolean;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const { tab: activeTab = TestCasePageTabs.TEST_CASE_RESULTS, version } =
    useRequiredParams<{ tab: EntityTabs; version: string }>();

  const { fqn: testCaseFQN } = useFqn();

  const {
    isLoading,
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

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { hasViewPermission, editDisplayNamePermission, hasDeletePermission } =
    useMemo(() => {
      return {
        hasViewPermission:
          testCasePermission?.ViewAll || testCasePermission?.ViewBasic,
        editDisplayNamePermission:
          testCasePermission?.EditAll || testCasePermission?.EditDisplayName,
        hasDeletePermission: testCasePermission?.Delete,
      };
    }, [testCasePermission]);

  const isExpandViewSupported = useMemo(
    () => activeTab === TestCasePageTabs.TEST_CASE_RESULTS,
    [activeTab]
  );

  const toggleTabExpanded = useCallback(() => {
    setIsTabExpanded(!isTabExpanded);
  }, [isTabExpanded, setIsTabExpanded]);

  const tabDetails: TabsProps['items'] = useMemo(() => {
    const tabs = testCaseClassBase.getTab(
      feedCount.openTaskCount,
      isVersionPage
    );

    return tabs.map(({ LabelComponent, labelProps, key, Tab }) => ({
      key,
      label: <LabelComponent {...labelProps} />,
      children: <Tab />,
    }));
  }, [feedCount.openTaskCount, testCaseClassBase.showSqlQueryTab]);

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

  const fetchTestCaseData = async () => {
    setIsLoading(true);
    try {
      const response = await getTestCaseByFqn(testCaseFQN, {
        fields: testCaseClassBase.getFields(),
      });
      testCaseClassBase.setShowSqlQueryTab(
        !isUndefined(response.inspectionQuery)
      );
      if (isVersionPage) {
        const versionResponse = await getTestCaseVersionList(response.id ?? '');
        setVersionList(versionResponse);
      }
      setTestCase(response);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.test-case') })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const breadcrumb = useMemo(() => {
    const data: TitleBreadcrumbProps['titleLinks'] = location.state
      ?.breadcrumbData
      ? location.state.breadcrumbData
      : [
          {
            name: t('label.incident-manager'),
            url: ROUTES.INCIDENT_MANAGER,
          },
        ];

    return [
      ...data,
      {
        name: testCase?.name ?? '',
        url: '',
        activeTitle: true,
      },
    ];
  }, [testCase]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        isVersionPage
          ? getTestCaseVersionPath(
              testCaseFQN,
              version,
              activeKey as TestCasePageTabs
            )
          : getTestCaseDetailPagePath(
              testCaseFQN,
              activeKey as TestCasePageTabs
            )
      );
    }
  };
  const updateTestCase = async (id: string, patch: PatchOperation[]) => {
    try {
      const res = await updateTestCaseById(id, patch);
      setTestCase(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
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

  const onVersionClick = () => {
    navigate(
      isVersionPage
        ? getTestCaseDetailPagePath(testCaseFQN)
        : getTestCaseVersionPath(
            testCaseFQN,
            toString(testCase?.version) ?? '',
            activeTab
          )
    );
  };

  // version related methods
  const versionHandler = useCallback(
    (newVersion = version) => {
      navigate(
        getTestCaseVersionPath(testCaseFQN, toString(newVersion), activeTab)
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
      fetchTestCaseData();
      getEntityFeedCount();
    } else {
      setIsLoading(false);
    }

    // Cleanup function for unmount
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

  if (isLoading || isPermissionLoading) {
    return <Loader />;
  }

  if (!hasViewPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.incident-manager'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (isUndefined(testCase)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1
      pageTitle={t(
        isVersionPage
          ? 'label.entity-version-detail-plural'
          : 'label.entity-detail-plural',
        {
          entity: getEntityName(testCase) || t('label.test-case'),
        }
      )}>
      <Row
        className={classNames({
          'version-data': isVersionPage,
        })}
        data-testid="incident-manager-details-page-container"
        gutter={[0, 12]}>
        <Col span={24}>
          <TitleBreadcrumb className="m-b-sm" titleLinks={breadcrumb} />
        </Col>
        <Col data-testid="entity-page-header" span={24}>
          <Row gutter={16}>
            <Col span={23}>
              <EntityHeaderTitle
                className="w-max-full-45"
                displayName={displayName}
                icon={<TestCaseIcon className="h-9" />}
                name={testCase?.name ?? ''}
                serviceName="testCase"
              />
            </Col>

            <Col className="d-flex justify-end" span={1}>
              <ButtonGroup
                className="data-asset-button-group spaced"
                data-testid="asset-header-btn-group"
                size="small">
                <Tooltip title={t('label.version-plural-history')}>
                  <Button
                    className="version-button"
                    data-testid="version-button"
                    icon={<Icon component={VersionIcon} />}
                    onClick={onVersionClick}>
                    <Typography.Text>{testCase?.version}</Typography.Text>
                  </Button>
                </Tooltip>
                {!isVersionPage && (
                  <ManageButton
                    isRecursiveDelete
                    afterDeleteAction={() => navigate(ROUTES.INCIDENT_MANAGER)}
                    allowSoftDelete={false}
                    canDelete={hasDeletePermission}
                    displayName={testCase.displayName}
                    editDisplayNamePermission={editDisplayNamePermission}
                    entityFQN={testCase.fullyQualifiedName}
                    entityId={testCase.id}
                    entityName={testCase.name}
                    entityType={EntityType.TEST_CASE}
                    onEditDisplayName={handleDisplayNameChange}
                  />
                )}
              </ButtonGroup>
            </Col>
          </Row>
        </Col>
        <Col className="w-full">
          <IncidentManagerPageHeader
            fetchTaskCount={getEntityFeedCount}
            isVersionPage={isVersionPage}
            testCaseData={testCase}
            onOwnerUpdate={handleOwnerChange}
          />
        </Col>
        <Col className="incident-manager-details-tabs" span={24}>
          <Tabs
            destroyInactiveTabPane
            activeKey={activeTab}
            className="tabs-new"
            data-testid="tabs"
            items={tabDetails}
            tabBarExtraContent={
              isExpandViewSupported && (
                <AlignRightIconButton
                  className={isTabExpanded ? 'rotate-180' : ''}
                  title={
                    isTabExpanded ? t('label.collapse') : t('label.expand')
                  }
                  onClick={toggleTabExpanded}
                />
              )
            }
            onChange={handleTabChange}
          />
        </Col>
      </Row>
      {isVersionPage && (
        <EntityVersionTimeLine
          currentVersion={toString(version)}
          entityType={EntityType.TEST_CASE}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={onVersionClick}
        />
      )}
    </PageLayoutV1>
  );
};

export default withActivityFeed(IncidentManagerDetailPage);
