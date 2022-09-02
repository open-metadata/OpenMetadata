/* eslint-disable @typescript-eslint/camelcase */
import { Button, Col, Row, Space, Tree, Typography } from 'antd';
import { AxiosError } from 'axios';
import { cloneDeep, isArray, isUndefined, map, startCase } from 'lodash';
import React, { Key, useEffect, useState } from 'react';
import {
  ActivityFeedSettings,
  getActivityFeedEventFilters,
  updateFilters,
} from '../../axiosAPIs/eventFiltersAPI';
import Loader from '../../components/Loader/Loader';
import { TERM_ALL } from '../../constants/constants';
import {
  EventFilter,
  Filters,
  SettingType,
} from '../../generated/settings/settings';
import jsonData from '../../jsons/en';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './ActivityFeedSettingsPage.style.less';
import { udpateKeys } from './ActivityFeedSettingsPage.utils';

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

  const handleExpandAll = () => {
    if (isArray(selectedKeys) && selectedKeys.length === eventFilters?.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(eventFilters?.map((e) => e.entityType) || []);
    }
  };

  const generateTreeData = (entityType: string, data?: Filters[]) => {
    return [
      {
        key: entityType,
        title: <strong>{startCase(entityType)}</strong>,
        data: true,
        children:
          data?.map(({ eventType, include, exclude }) => {
            const key = `${entityType}-${eventType}` as string;

            return {
              key: key,
              title: startCase(eventType),
              data: include,
              children:
                include?.length === 1 && include[0] === TERM_ALL
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
        config_value: udpateKeys(deepClonedTree, eventFilters),
        // eventFilters?.map((filter) =>
        //   deepClonedTree[filter.entityType]
        //     ? {
        //         ...filter,
        //         filters: getPayloadFromSelected(
        //           deepClonedTree,
        //           filter.entityType,
        //           flatMap(
        //             filter.filters?.map((f) => {
        //               return f.eventType === EventType.EntityUpdated
        //                 ? [...(f.include ?? []), ...(f.exclude ?? [])]
        //                 : [];
        //             })
        //           )
        //         ),
        //       }
        //     : filter
        // ),
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
            <Button type="primary" onClick={onSave}>
              Save
            </Button>
          </Typography.Link>
        </Space>
      </Col>
      <Col span={24}>
        {map(eventFilters, ({ entityType, filters }) => (
          <>
            {entityType !== TERM_ALL ? (
              <div className="tw-rounded-border" key={entityType}>
                <Tree
                  checkable
                  defaultExpandAll
                  className="activity-feed-settings-tree"
                  defaultCheckedKeys={checkedKeys}
                  icon={null}
                  key={entityType}
                  treeData={generateTreeData(entityType, filters)}
                  onCheck={(keys) =>
                    handleTreeCheckChange(keys as Key[], entityType)
                  }
                />
              </div>
            ) : //     <Collapse.Panel
            //       extra={
            //         <Button
            //           disabled={
            //             !updatedTree ||
            //             isUndefined(updatedTree[entityType]) ||
            //             isEmpty(updatedTree[entityType])
            //           }
            //           type="primary"
            //           onClick={(event) => onSave(event)}>
            //           Save
            //         </Button>
            //       }
            //       header={
            //         <Row>
            //           <Typography.Text strong>
            //             {ActivityFeedEntity[entityType]}
            //           </Typography.Text>
            //         </Row>
            //       }
            //       key={entityType}>

            //     </Collapse.Panel>
            null}
          </>
        ))}
      </Col>
    </Row>
  );
};

export default ActivityFeedSettingsPage;
