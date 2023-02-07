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
  Col,
  Form,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tooltip,
} from 'antd';
import { RadioChangeEvent } from 'antd/lib/radio';
import { SwitchChangeEventHandler } from 'antd/lib/switch';
import { AxiosError } from 'axios';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { t } from 'i18next';
import { EntityTags, ExtraInfo } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { addFollower, removeFollower } from 'rest/tableAPI';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTableTabPath,
  getTeamAndUserDetailsPath,
} from '../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { PROFILER_FILTER_RANGE } from '../../constants/profiler.constant';
import { EntityType, FqnPart } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { OwnerType } from '../../enums/user.enum';
import { Column, Table } from '../../generated/entity/data/table';
import { TestCaseStatus } from '../../generated/tests/testCase';
import { EntityReference } from '../../generated/type/entityReference';
import { LabelType, State } from '../../generated/type/tagLabel';
import jsonData from '../../jsons/en';
import {
  getCurrentUserId,
  getEntityName,
  getEntityPlaceHolder,
  getNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  getAddDataQualityTableTestPath,
  getProfilerDashboardWithFqnPath,
} from '../../utils/RouterUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getDecodedFqn } from '../../utils/StringsUtils';
import {
  generateEntityLink,
  getTagsWithoutTier,
  getTierTags,
  getUsagePercentile,
} from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import DataQualityTab from './component/DataQualityTab';
import ProfilerTab from './component/ProfilerTab';
import {
  ProfilerDashboardProps,
  ProfilerDashboardTab,
} from './profilerDashboard.interface';
import './profilerDashboard.less';

const ProfilerDashboard: React.FC<ProfilerDashboardProps> = ({
  table,
  testCases,
  fetchProfilerData,
  fetchTestCases,
  onTestCaseUpdate,
  isTestCaseLoading,
  profilerData,
  onTableChange,
}) => {
  const { getEntityPermission } = usePermissionProvider();
  const history = useHistory();
  const { entityTypeFQN, dashboardType, tab } = useParams<{
    entityTypeFQN: string;
    dashboardType: ProfilerDashboardType;
    tab: ProfilerDashboardTab;
  }>();
  const decodedEntityFQN = getDecodedFqn(entityTypeFQN);
  const isColumnView = dashboardType === ProfilerDashboardType.COLUMN;
  const [follower, setFollower] = useState<EntityReference[]>([]);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [showDeletedTest, setShowDeletedTest] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ProfilerDashboardTab>(
    tab ?? ProfilerDashboardTab.PROFILER
  );
  const [selectedTestCaseStatus, setSelectedTestCaseStatus] =
    useState<string>('');
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<keyof typeof PROFILER_FILTER_RANGE>('last3days');
  const [activeColumnDetails, setActiveColumnDetails] = useState<Column>(
    {} as Column
  );

  const [tablePermissions, setTablePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const fetchResourcePermission = async () => {
    try {
      const tablePermission = await getEntityPermission(
        ResourceEntity.TABLE,
        table.id
      );

      setTablePermissions(tablePermission);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const tabOptions = useMemo(() => {
    return Object.values(ProfilerDashboardTab).filter((value) => {
      if (value === ProfilerDashboardTab.PROFILER) {
        return isColumnView;
      }

      return value;
    });
  }, [dashboardType]);

  const timeRangeOption = useMemo(() => {
    return Object.entries(PROFILER_FILTER_RANGE).map(([key, value]) => ({
      label: value.title,
      value: key,
    }));
  }, []);

  const testCaseStatusOption = useMemo(() => {
    const testCaseStatus: Record<string, string>[] = Object.values(
      TestCaseStatus
    ).map((value) => ({
      label: value,
      value: value,
    }));
    testCaseStatus.unshift({
      label: 'All',
      value: '',
    });

    return testCaseStatus;
  }, []);

  const tier = useMemo(() => getTierTags(table.tags ?? []), [table]);
  const breadcrumb = useMemo(() => {
    const serviceName = getEntityName(table.service);
    const fqn = table.fullyQualifiedName || '';
    const columnName = getPartialNameFromTableFQN(decodedEntityFQN, [
      FqnPart.NestedColumn,
    ]);

    const data: TitleBreadcrumbProps['titleLinks'] = [
      {
        name: getEntityName(table.service),
        url: serviceName
          ? getServiceDetailsPath(
              serviceName,
              ServiceCategory.DATABASE_SERVICES
            )
          : '',
        imgSrc: table.serviceType
          ? serviceTypeLogo(table.serviceType)
          : undefined,
      },
      {
        name: getPartialNameFromTableFQN(fqn, [FqnPart.Database]),
        url: getDatabaseDetailsPath(table.database?.fullyQualifiedName || ''),
      },
      {
        name: getPartialNameFromTableFQN(fqn, [FqnPart.Schema]),
        url: getDatabaseSchemaDetailsPath(
          table.databaseSchema?.fullyQualifiedName || ''
        ),
      },
      {
        name: getEntityName(table),
        url: isColumnView
          ? getTableTabPath(table.fullyQualifiedName || '', 'profiler')
          : '',
      },
    ];

    if (isColumnView) {
      data.push({
        name: columnName,
        url: '',
        activeTitle: true,
      });
    }

    return data;
  }, [table]);

  const extraInfo: Array<ExtraInfo> = useMemo(() => {
    return [
      {
        key: 'Owner',
        value:
          table.owner?.type === OwnerType.TEAM
            ? getTeamAndUserDetailsPath(table.owner?.name || '')
            : getEntityName(table.owner),
        placeholderText: getEntityPlaceHolder(
          getEntityName(table.owner),
          table.owner?.deleted
        ),
        isLink: table.owner?.type === OwnerType.TEAM,
        openInNewTab: false,
        profileName:
          table.owner?.type === OwnerType.USER ? table.owner?.name : undefined,
      },
      {
        key: 'Tier',
        value: tier?.tagFQN ? tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1] : '',
      },
      { key: 'Type', value: `${table.tableType}`, showLabel: true },
      {
        value:
          getUsagePercentile(
            table.usageSummary?.weeklyStats?.percentileRank || 0,
            true
          ) || '--',
      },
      {
        value: `${
          table.usageSummary?.weeklyStats?.count.toLocaleString() || '--'
        } Queries`,
      },
    ];
  }, [table]);

  const handleOwnerUpdate = (newOwner?: Table['owner']) => {
    if (newOwner) {
      const updatedTableDetails = {
        ...table,
        owner: {
          ...table.owner,
          ...newOwner,
        },
      };
      onTableChange(updatedTableDetails);
    }
  };

  const handleOwnerRemove = () => {
    if (table) {
      const updatedTableDetails = {
        ...table,
        owner: undefined,
      };
      onTableChange(updatedTableDetails);
    }
  };

  const handleTierRemove = () => {
    if (table) {
      const updatedTableDetails = {
        ...table,
        tags: undefined,
      };
      onTableChange(updatedTableDetails);
    }
  };

  const handleTierUpdate = (newTier?: string) => {
    if (newTier) {
      const tierTag: Table['tags'] = newTier
        ? [
            ...getTagsWithoutTier(table.tags as Array<EntityTags>),
            {
              tagFQN: newTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : table.tags;
      const updatedTableDetails = {
        ...table,
        tags: tierTag,
      };

      return onTableChange(updatedTableDetails);
    } else {
      return Promise.reject();
    }
  };

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const handleTagUpdate = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTable = { ...table, tags: updatedTags };
      onTableChange(updatedTable);
    }
  };

  const unfollowTable = async () => {
    try {
      const data = await removeFollower(table.id, getCurrentUserId());
      const { oldValue } = data.changeDescription.fieldsDeleted[0];

      setFollower(
        follower.filter((follower) => follower.id !== oldValue[0].id)
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-entity-unfollow-error']
      );
    }
  };
  const followTable = async () => {
    try {
      const data = await addFollower(table.id, getCurrentUserId());
      const { newValue } = data.changeDescription.fieldsAdded[0];

      setFollower([...follower, ...newValue]);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-entity-follow-error']
      );
    }
  };

  const handleFollowClick = () => {
    if (isFollowing) {
      setIsFollowing(false);
      unfollowTable();
    } else {
      setIsFollowing(true);
      followTable();
    }
  };

  const handleTabChange = (e: RadioChangeEvent) => {
    const value = e.target.value as ProfilerDashboardTab;
    if (ProfilerDashboardTab.SUMMARY === value) {
      history.push(getTableTabPath(table.fullyQualifiedName || '', 'profiler'));

      return;
    } else if (
      ProfilerDashboardTab.DATA_QUALITY === value &&
      (tablePermissions.ViewAll ||
        tablePermissions.ViewBasic ||
        tablePermissions.ViewTests)
    ) {
      fetchTestCases(generateEntityLink(decodedEntityFQN, true));
    } else if (
      ProfilerDashboardTab.PROFILER === value &&
      (tablePermissions.ViewAll ||
        tablePermissions.ViewBasic ||
        tablePermissions.ViewDataProfile)
    ) {
      fetchProfilerData(entityTypeFQN);
    }
    setSelectedTestCaseStatus('');
    setActiveTab(value);
    setShowDeletedTest(false);
    history.push(
      getProfilerDashboardWithFqnPath(dashboardType, entityTypeFQN, value)
    );
  };

  const handleAddTestClick = () => {
    history.push(
      getAddDataQualityTableTestPath(
        isColumnView
          ? ProfilerDashboardType.COLUMN
          : ProfilerDashboardType.TABLE,
        entityTypeFQN || ''
      )
    );
  };

  const handleTimeRangeChange = (value: keyof typeof PROFILER_FILTER_RANGE) => {
    if (value !== selectedTimeRange) {
      setSelectedTimeRange(value);
      if (activeTab === ProfilerDashboardTab.PROFILER) {
        fetchProfilerData(entityTypeFQN, PROFILER_FILTER_RANGE[value].days);
      }
    }
  };

  const handleTestCaseStatusChange = (value: string) => {
    if (value !== selectedTestCaseStatus) {
      setSelectedTestCaseStatus(value);
    }
  };

  const getFilterTestCase = () => {
    const dataByStatus = testCases.filter(
      (data) =>
        selectedTestCaseStatus === '' ||
        data.testCaseResult?.testCaseStatus === selectedTestCaseStatus
    );

    return dataByStatus;
  };

  const handleDeletedTestCaseClick: SwitchChangeEventHandler = (value) => {
    setShowDeletedTest(value);
    onTestCaseUpdate(value);
  };

  const handleTestUpdate = () => {
    onTestCaseUpdate(showDeletedTest);
  };

  useEffect(() => {
    if (table) {
      if (isColumnView) {
        const columnName = getNameFromFQN(decodedEntityFQN);
        const selectedColumn = table.columns.find(
          (col) => col.name === columnName
        );
        setActiveColumnDetails(selectedColumn || ({} as Column));
      }
      setFollower(table?.followers || []);
      setIsFollowing(
        follower.some(({ id }: { id: string }) => id === getCurrentUserId())
      );

      fetchResourcePermission();
    }
  }, [table]);

  return (
    <PageLayoutV1>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <EntityPageInfo
            isTagEditable
            currentOwner={table.owner}
            deleted={table.deleted}
            entityFqn={table.fullyQualifiedName}
            entityId={table.id}
            entityName={table.name}
            entityType={EntityType.TABLE}
            extraInfo={extraInfo}
            followHandler={handleFollowClick}
            followers={follower.length}
            followersList={follower}
            isFollowing={isFollowing}
            removeOwner={
              tablePermissions.EditAll || tablePermissions.EditOwner
                ? handleOwnerRemove
                : undefined
            }
            removeTier={
              tablePermissions.EditAll || tablePermissions.EditTier
                ? handleTierRemove
                : undefined
            }
            tags={getTagsWithoutTier(table.tags || [])}
            tagsHandler={handleTagUpdate}
            tier={tier}
            titleLinks={breadcrumb}
            updateOwner={
              tablePermissions.EditAll || tablePermissions.EditOwner
                ? handleOwnerUpdate
                : undefined
            }
            updateTier={
              tablePermissions.EditAll || tablePermissions.EditTier
                ? handleTierUpdate
                : undefined
            }
          />
        </Col>
        <Col span={24}>
          <Row justify="space-between">
            <Radio.Group
              buttonStyle="solid"
              className="profiler-switch"
              data-testid="profiler-switch"
              optionType="button"
              options={tabOptions}
              value={activeTab}
              onChange={handleTabChange}
            />

            <Space size={16}>
              {activeTab === ProfilerDashboardTab.DATA_QUALITY && (
                <>
                  <Form.Item className="m-0 " label="Deleted Tests">
                    <Switch
                      checked={showDeletedTest}
                      onClick={handleDeletedTestCaseClick}
                    />
                  </Form.Item>
                  <Form.Item className="tw-mb-0 tw-w-40" label="Status">
                    <Select
                      options={testCaseStatusOption}
                      value={selectedTestCaseStatus}
                      onChange={handleTestCaseStatusChange}
                    />
                  </Form.Item>
                </>
              )}
              {activeTab === ProfilerDashboardTab.PROFILER && (
                <Select
                  className="tw-w-32"
                  options={timeRangeOption}
                  value={selectedTimeRange}
                  onChange={handleTimeRangeChange}
                />
              )}
              <Tooltip
                title={
                  tablePermissions.EditAll || tablePermissions.EditTests
                    ? 'Add Test'
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  data-testid="add-test"
                  disabled={
                    !(tablePermissions.EditAll || tablePermissions.EditTests)
                  }
                  type="primary"
                  onClick={handleAddTestClick}>
                  {t('label.add-entity', { entity: t('label.test') })}
                </Button>
              </Tooltip>
            </Space>
          </Row>
        </Col>
        {activeTab === ProfilerDashboardTab.PROFILER && (
          <Col span={24}>
            <ProfilerTab
              activeColumnDetails={activeColumnDetails}
              profilerData={profilerData}
              tableProfile={table.profile}
            />
          </Col>
        )}

        {activeTab === ProfilerDashboardTab.DATA_QUALITY && (
          <Col span={24}>
            <DataQualityTab
              deletedTable={showDeletedTest}
              hasAccess={tablePermissions.EditAll}
              isLoading={isTestCaseLoading}
              testCases={getFilterTestCase()}
              onTestUpdate={handleTestUpdate}
            />
          </Col>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default ProfilerDashboard;
