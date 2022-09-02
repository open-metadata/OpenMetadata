import { Button, Col, Collapse, Row, Space, Tree, Typography } from 'antd';
import { AxiosError } from 'axios';
import {
  cloneDeep,
  isArray,
  isEmpty,
  isUndefined,
  map,
  startCase,
} from 'lodash';
import React, { Key, useEffect, useState } from 'react';
import { ReactComponent as DownArrow } from '../../assets/svg/down-arrow.svg';
import { ReactComponent as RightArrow } from '../../assets/svg/right-arrow.svg';
import {
  createOrUpdateActivityFeedEventFilter,
  getActivityFeedEventFilters,
} from '../../axiosAPIs/eventFiltersAPI';
import Loader from '../../components/Loader/Loader';
import { TERM_ALL } from '../../constants/constants';
import { EventFilter, Filters } from '../../generated/settings/settings';
import jsonData from '../../jsons/en';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import {
  ActivityFeedEntity,
  formData,
} from './ActivityFeedSettingsPage.constants';
import './ActivityFeedSettingsPage.style.less';
import { getPayloadFromSelected } from './ActivityFeedSettingsPage.utils';

const ActivityFeedSettingsPage: React.FC = () => {
  const [eventFilters, setEventFilters] = useState<EventFilter[]>();
  const [loading, setLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<string | string[]>([]);
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

  const createActivityFeed = async (
    entityName: string,
    selectedData: Filters[]
  ) => {
    try {
      setLoading(true);
      const data = await createOrUpdateActivityFeedEventFilter(
        entityName,
        selectedData
      );
      const filteredData = data?.filter(
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

  const handleExpandStateChange = (keys: string | string[]) => {
    setSelectedKeys(keys);
    const key = [...keys];

    setSelectedKey(key[key.length - 1]);
  };

  const handleExpandAll = () => {
    if (isArray(selectedKeys) && selectedKeys.length === eventFilters?.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(eventFilters?.map((e) => e.entityType) || []);
    }
  };

  const generateTreeData = (entityType: string, data?: Filters[]) => {
    return data?.map(({ eventType, include }) => {
      const key = `${entityType}-${eventType}` as string;

      return {
        key: key,
        title: startCase(eventType),
        data: include,
        children:
          eventType === 'entityUpdated'
            ? [
                {
                  key: `${key}-owner`,
                  title: 'Owner',
                },
                {
                  key: `${key}-description`,
                  title: 'Description',
                },
                {
                  key: `${key}-tags`,
                  title: 'Tags',
                },
                {
                  key: `${key}-followers`,
                  title: 'Followers',
                },
              ]
            : undefined,
      };
    });
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

    if (!isUndefined(updatedTree) && selectedKey) {
      const deepClonedTree = cloneDeep(updatedTree);

      const selectedTree = {
        [selectedKey]: deepClonedTree[selectedKey],
      };
      const value = getPayloadFromSelected(selectedTree, selectedKey);

      createActivityFeed(selectedKey, value as Filters[]);
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
  }, [eventFilters, selectedKeys, updatedTree, selectedKey]);

  return loading ? (
    <Col span={24}>
      <Loader />
    </Col>
  ) : (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Space align="baseline" className="tw-flex tw-justify-between">
          <Typography.Title level={5} type="secondary">
            Activity Feed
          </Typography.Title>
          <Typography.Link onClick={handleExpandAll}>
            {selectedKeys.length === eventFilters?.length
              ? 'Collapse All'
              : 'Expand All'}
          </Typography.Link>
        </Space>
      </Col>
      <Col span={24}>
        <Collapse
          destroyInactivePanel
          activeKey={selectedKeys}
          className="activity-feed-collapse"
          expandIcon={({ isActive }) => {
            return (
              <>
                {isActive ? (
                  <Row className="arrow">
                    <DownArrow />{' '}
                  </Row>
                ) : (
                  <Row className="arrow">
                    <RightArrow />
                  </Row>
                )}
              </>
            );
          }}
          onChange={handleExpandStateChange}>
          {map(eventFilters, ({ entityType }) => (
            <>
              {entityType !== TERM_ALL ? (
                <Collapse.Panel
                  extra={
                    <Button
                      disabled={
                        !updatedTree ||
                        isUndefined(updatedTree[entityType]) ||
                        isEmpty(updatedTree[entityType])
                      }
                      type="primary"
                      onClick={(event) => onSave(event)}>
                      Save
                    </Button>
                  }
                  header={
                    <Row>
                      <Typography.Text strong>
                        {ActivityFeedEntity[entityType]}
                      </Typography.Text>
                    </Row>
                  }
                  key={entityType}>
                  <Tree
                    checkable
                    defaultCheckedKeys={checkedKeys}
                    key={entityType}
                    treeData={generateTreeData(entityType, formData)}
                    onCheck={(keys) =>
                      handleTreeCheckChange(keys as Key[], entityType)
                    }
                  />
                </Collapse.Panel>
              ) : null}
            </>
          ))}
        </Collapse>
      </Col>
    </Row>
  );
};

export default ActivityFeedSettingsPage;
