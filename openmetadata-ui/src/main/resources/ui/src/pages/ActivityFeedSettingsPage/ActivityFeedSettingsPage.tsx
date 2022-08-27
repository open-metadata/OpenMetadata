import { Button, Col, Collapse, Row, Space, Tree, Typography } from 'antd';
import { AxiosError } from 'axios';
import { capitalize, cloneDeep, isEmpty, map, startCase } from 'lodash';
import React, { useEffect, useState } from 'react';
import { getActivityFeedEventFilters } from '../../axiosAPIs/eventFiltersAPI';
import Loader from '../../components/Loader/Loader';
import { EventFilter, Filters } from '../../generated/settings/settings';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

// const entity = [
//   {
//     name: 'Tables',
//     key: 'tables',
//     data: [
//       {
//         title: 'Create',
//         key: 'create',
//       },
//       {
//         title: 'Update',
//         key: 'udpate',
//         children: [
//           {
//             title: 'Owner',
//             key: 'owner',
//           },
//           {
//             title: 'Description',
//             key: 'description',
//           },
//           {
//             title: 'Tags',
//             key: 'tags',
//           },
//           {
//             title: 'Followers',
//             key: 'followers',
//           },
//         ],
//       },
//       {
//         title: 'Delete',
//         key: 'delete',
//       },
//     ],
//   },
//   {
//     name: 'Topics',
//     key: 'topics',
//     data: [
//       {
//         title: 'Create',
//         key: 'create',
//       },
//       {
//         title: 'Update',
//         key: 'udpate',
//         children: [
//           {
//             title: 'Owner',
//             key: 'owner',
//           },
//           {
//             title: 'Description',
//             key: 'description',
//           },
//           {
//             title: 'Tags',
//             key: 'tags',
//           },
//           {
//             title: 'Followers',
//             key: 'followers',
//           },
//         ],
//       },
//       {
//         title: 'Delete',
//         key: 'delete',
//       },
//     ],
//   },
//   {
//     name: 'Dashboards',
//     key: 'dashboards',
//     data: [
//       {
//         title: 'Create',
//         key: 'create',
//       },
//       {
//         title: 'Update',
//         key: 'udpate',
//         children: [
//           {
//             title: 'Owner',
//             key: 'owner',
//           },
//           {
//             title: 'Description',
//             key: 'description',
//           },
//           {
//             title: 'Tags',
//             key: 'tags',
//           },
//           {
//             title: 'Followers',
//             key: 'followers',
//           },
//         ],
//       },
//       {
//         title: 'Delete',
//         key: 'delete',
//       },
//     ],
//   },
//   {
//     name: 'Pipelines',
//     key: 'pipelines',
//     data: [
//       {
//         title: 'Create',
//         key: 'create',
//       },
//       {
//         title: 'Update',
//         key: 'udpate',
//         children: [
//           {
//             title: 'Owner',
//             key: 'owner',
//           },
//           {
//             title: 'Description',
//             key: 'description',
//           },
//           {
//             title: 'Tags',
//             key: 'tags',
//           },
//           {
//             title: 'Followers',
//             key: 'followers',
//           },
//         ],
//       },
//       {
//         title: 'Delete',
//         key: 'delete',
//       },
//     ],
//   },
//   {
//     name: 'ML Models',
//     key: 'mlmodels',
//     data: [
//       {
//         title: 'Create',
//         key: 'create',
//       },
//       {
//         title: 'Update',
//         key: 'udpate',
//         children: [
//           {
//             title: 'Owner',
//             key: 'owner',
//           },
//           {
//             title: 'Description',
//             key: 'description',
//           },
//           {
//             title: 'Tags',
//             key: 'tags',
//           },
//           {
//             title: 'Followers',
//             key: 'followers',
//           },
//         ],
//       },
//       {
//         title: 'Delete',
//         key: 'delete',
//       },
//     ],
//   },
// ];

const ActivityFeedSettingsPage: React.FC = () => {
  const [eventFilters, setEventFilters] = useState<EventFilter[]>();
  const [loading, setLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<string | string[]>([]);
  const [updatedTree, setUpdatedTree] = useState<Record<string, string[]>>();

  const fetchEventFilters = async () => {
    try {
      const data = await getActivityFeedEventFilters();

      setEventFilters(data);
    } catch (error) {
      const err = error as AxiosError;
      showErrorToast(err, jsonData['api-error-messages']['fetch-settings']);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventFilters();
  }, []);

  const handleExpandStateChange = (keys: string | string[]) => {
    setSelectedKeys(keys);
  };

  const handleExpandAll = () => {
    if (selectedKeys.length === eventFilters?.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(eventFilters?.map((e) => e.entityType) || []);
    }
  };

  const generateTreeData = (data?: Filters[]) => {
    return data?.map(({ eventType, fields }) => {
      return {
        key: eventType,
        title: startCase(eventType),
        data: fields,
        children:
          eventType === 'entityUpdated'
            ? [
                {
                  key: `${eventType}-owner`,
                  title: 'Owner',
                },
                {
                  key: `${eventType}-description`,
                  title: 'Description',
                },
                {
                  key: `${eventType}-tags`,
                  title: 'Tags',
                },
                {
                  key: `${eventType}-followers`,
                  title: 'Followers',
                },
              ]
            : undefined,
      };
    });
  };

  const handleTreeCheckChange = (keys: string[], entityType: string) => {
    setSelectedKeys(entityType);

    const updateData = cloneDeep(updatedTree || {});

    updateData[entityType] = keys;

    setUpdatedTree(updateData);
  };

  return loading ? (
    <Col span={24}>
      <Loader />
    </Col>
  ) : (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Space align="baseline" className="tw-justify-between">
          <Typography.Title level={5} type="secondary">
            Activity Feed
          </Typography.Title>
          <Button size="small" type="text" onClick={handleExpandAll}>
            {selectedKeys.length === eventFilters?.length
              ? 'Collapse All'
              : 'Expand All'}
          </Button>
        </Space>
      </Col>
      <Col span={24}>
        <Collapse defaultActiveKey="Table" onChange={handleExpandStateChange}>
          {map(eventFilters, ({ entityType, filters }) => (
            <Collapse.Panel
              extra={
                <Button
                  disabled={
                    !updatedTree ||
                    (updatedTree && isEmpty(updatedTree[entityType]))
                  }
                  type="primary">
                  Save
                </Button>
              }
              header={capitalize(entityType)}
              key={entityType}>
              <Tree
                checkable
                treeData={generateTreeData(filters)}
                onCheck={(keys: string[]) =>
                  handleTreeCheckChange(keys, entityType)
                }
              />
            </Collapse.Panel>
          ))}
        </Collapse>
      </Col>
    </Row>
  );
};

export default ActivityFeedSettingsPage;
