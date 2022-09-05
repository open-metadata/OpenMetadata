/* eslint-disable @typescript-eslint/camelcase */
import {
  Button,
  Card,
  Col,
  Divider,
  Row,
  Space,
  Tooltip,
  Tree,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { cloneDeep, isUndefined, map, startCase } from 'lodash';
import React, { Key, useEffect, useState } from 'react';
import {
  ActivityFeedSettings,
  getActivityFeedEventFilters,
  resetAllFilters,
  updateFilters,
} from '../../axiosAPIs/eventFiltersAPI';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../../components/Loader/Loader';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import { TERM_ALL } from '../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { Operation } from '../../generated/entity/policies/policy';
import {
  EventFilter,
  Filters,
  SettingType,
} from '../../generated/settings/settings';
import jsonData from '../../jsons/en';
import { checkPermission } from '../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './ActivityFeedSettingsPage.style.less';
import { getEventFilterFromTree } from './ActivityFeedSettingsPage.utils';

const ActivityFeedSettingsPage: React.FC = () => {
  const [eventFilters, setEventFilters] = useState<EventFilter[]>();
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [updatedTree, setUpdatedTree] = useState<Record<string, string[]>>();

  const fetchEventFilters = async () => {
    try {
      const data = await getActivityFeedEventFilters();

      const filteredData = data?.filter(
        ({ entityType }) => entityType !== TERM_ALL
      );

      setEventFilters(filteredData);
    } catch (error) {
      const err = error as AxiosError;
      showErrorToast(err, jsonData['api-error-messages']['fetch-settings']);
    } finally {
      setLoading(false);
    }
  };

  const createActivityFeed = async (req: ActivityFeedSettings) => {
    try {
      setLoading(true);
      const data = await updateFilters(req);
      const filteredData = data.config_value?.filter(
        ({ entityType }) => entityType !== TERM_ALL
      );

      setEventFilters(filteredData);
      showSuccessToast(
        jsonData['api-success-messages']['add-settings-success']
      );
    } catch {
      showErrorToast(jsonData['api-error-messages']['add-settings-error']);
    } finally {
      setLoading(false);
    }
  };

  const generateTreeData = (entityType: string, data?: Filters[]) => {
    return [
      {
        key: entityType,
        title: (
          <Typography.Text strong>{startCase(entityType)}</Typography.Text>
        ),
        data: true,
        children:
          data?.map(({ eventType, include, exclude }) => {
            const key = `${entityType}-${eventType}` as string;

            return {
              key: key,
              title: startCase(eventType),
              data: include,
              children:
                (include?.length === 1 && include[0] === TERM_ALL) ||
                (exclude?.length === 1 && exclude[0] === TERM_ALL)
                  ? undefined
                  : [
                      ...(include?.map((inc) => ({
                        key: `${key}-${inc}`,
                        title: startCase(inc),
                        data: true,
                      })) || []),
                      ...(exclude?.map((ex) => ({
                        key: `${key}-${ex}`,
                        title: startCase(ex),
                        data: false,
                      })) || []),
                    ],
            };
          }) || [],
      },
    ];
  };

  const getCheckedKeys = (eventFilters: EventFilter[]) => {
    const checkedArray = [] as string[];
    const clonedFilters = cloneDeep(eventFilters);

    clonedFilters?.map(({ entityType, filters }) => {
      filters &&
        filters.map((obj) => {
          if (
            obj.include &&
            obj.include.length === 1 &&
            obj.include[0] === 'all'
          ) {
            checkedArray.push(`${entityType}-${obj.eventType}`);
          } else {
            obj?.include?.forEach((entityUpdated) => {
              const name = `${entityType}-${obj.eventType}-${entityUpdated}`;
              checkedArray.push(name);
            });
          }
        });
    });

    return checkedArray;
  };

  const handleTreeCheckChange = (keys: Key[], entityType: string) => {
    const key = String(keys[0]).split('-')[0];
    setCheckedKeys(keys as string[]);
    const updateData = cloneDeep(updatedTree || {});

    updateData[entityType] = keys as string[];

    setUpdatedTree(updateData);
    setSelectedKey(key);
  };

  const onSave = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.stopPropagation();

    if (!isUndefined(updatedTree) && selectedKey && eventFilters) {
      const deepClonedTree = cloneDeep(updatedTree);

      const data = {
        config_type: SettingType.ActivityFeedFilterSetting,
        config_value: getEventFilterFromTree(deepClonedTree, eventFilters),
      } as ActivityFeedSettings;

      createActivityFeed(data);
      setUpdatedTree(undefined);
      setSelectedKey(undefined);
    }
  };

  useEffect(() => {
    fetchEventFilters();
  }, []);

  useEffect(() => {
    const checkKeys = getCheckedKeys(eventFilters as EventFilter[]);

    setCheckedKeys(checkKeys);
  }, [eventFilters, updatedTree, selectedKey]);

  const { permissions } = usePermissionProvider();

  const editPermission = checkPermission(
    Operation.EditAll,
    ResourceEntity.FEED,
    permissions
  );
  const createPermission = checkPermission(
    Operation.Create,
    ResourceEntity.FEED,
    permissions
  );

  const handleResetClick = async () => {
    try {
      setLoading(true);
      const data = await resetAllFilters();
      const filteredData = data.config_value?.filter(
        ({ entityType }) => entityType !== TERM_ALL
      );

      setEventFilters(filteredData);
      showSuccessToast(
        jsonData['api-success-messages']['add-settings-success']
      );
    } catch {
      showErrorToast(jsonData['api-error-messages']['add-settings-error']);
    } finally {
      setLoading(false);
    }
  };

  return loading ? (
    <Col span={24}>
      <Loader />
    </Col>
  ) : (
    <>
      {eventFilters ? (
        <>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Typography.Title
                level={5}
                style={{ margin: 0 }}
                type="secondary">
                Activity Feed
              </Typography.Title>
            </Col>
            <Col span={24}>
              <Card className="settings-page-card-container" size="small">
                {eventFilters &&
                  map(eventFilters, ({ entityType, filters }, index) => (
                    <>
                      {entityType !== TERM_ALL ? (
                        <div
                          className="activity-feed-settings-tree"
                          key={entityType}>
                          <Tree
                            checkable
                            defaultExpandAll
                            defaultCheckedKeys={checkedKeys}
                            icon={null}
                            key={entityType}
                            treeData={generateTreeData(entityType, filters)}
                            onCheck={(keys) =>
                              handleTreeCheckChange(keys as Key[], entityType)
                            }
                          />
                          {index !== eventFilters?.length - 1 && <Divider />}
                        </div>
                      ) : null}
                    </>
                  ))}
              </Card>
            </Col>
            <Col>
              <Space direction="horizontal" size={16}>
                <Tooltip
                  title={
                    editPermission || createPermission
                      ? ''
                      : NO_PERMISSION_FOR_ACTION
                  }>
                  <Button
                    disabled={!(editPermission || createPermission)}
                    type="primary"
                    onClick={onSave}>
                    Save
                  </Button>
                </Tooltip>
                <Tooltip
                  title={createPermission ? '' : NO_PERMISSION_FOR_ACTION}>
                  <Button
                    disabled={!createPermission}
                    type="text"
                    onClick={handleResetClick}>
                    Reset all
                  </Button>
                </Tooltip>
              </Space>
            </Col>
            <Col span={24} />
            <Col span={24} />
          </Row>
        </>
      ) : (
        <ErrorPlaceHolder>
          <Typography.Text>No activity feed settings available</Typography.Text>
        </ErrorPlaceHolder>
      )}
    </>
  );
};

export default ActivityFeedSettingsPage;
