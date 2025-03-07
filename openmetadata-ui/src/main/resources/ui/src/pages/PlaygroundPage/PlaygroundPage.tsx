/*
 *  Copyright 2025 Collate.
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
/* eslint-disable i18next/no-literal-string */
import { Button, Card, Col, Row, Space, Tabs, Typography } from 'antd';
import classNames from 'classnames';
import { noop } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../components/ActivityFeed/ActivityFeedPanel/feed-panel-body-v1.less';
import '../../components/ActivityFeed/ActivityFeedTab/activity-feed-tab-new.less';
import TaskFeedCard from '../../components/ActivityFeed/TaskFeedCard/TaskFeedCardNew.component';
import '../../components/Entity/Task/TaskTab/task-tab-new.less';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { Post, Thread } from '../../generated/entity/feed/thread';
import './playground.less';

const TASKS = [
  {
    id: '8e7ab04f-d15f-4d6d-9dca-ab81d876687c',
    type: 'Task',
    href: 'http://localhost:8585/api/v1/feed/8e7ab04f-d15f-4d6d-9dca-ab81d876687c',
    threadTs: 1741345984213,
    about: '<#E::databaseSchema::mysql_sample.default.posts_db::description>',
    entityRef: {
      id: '362f1504-558b-437c-9e71-9fcfed4e1b47',
      type: 'databaseSchema',
      name: 'posts_db',
      fullyQualifiedName: 'mysql_sample.default.posts_db',
      displayName: 'posts_db',
      deleted: false,
    },
    generatedBy: 'user',
    cardStyle: 'default',
    fieldOperation: 'updated',
    createdBy: 'admin',
    updatedAt: 1741345984213,
    updatedBy: 'admin',
    resolved: false,
    message: 'Request description for databaseSchema posts_db',
    postsCount: 0,
    posts: [],
    reactions: [],
    task: {
      id: 17,
      type: 'RequestDescription',
      assignees: [
        {
          id: 'bd480e8b-ec8e-4694-945c-46571c3b334e',
          type: 'user',
          name: 'admin',
          fullyQualifiedName: 'admin',
          displayName: 'admin',
          deleted: false,
        },
      ],
      status: 'Open',
      oldValue: '',
      suggestion:
        // eslint-disable-next-line max-len
        '<h2>What is Lorem Ipsum?</h2><p><strong>Lorem Ipsum</strong> is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.</p><h2>Why do we use it?</h2><p>It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using \'Content here, content here\', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for \'lorem ipsum\' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).</p><p><br></p><h2>Where does it come from?</h2><p>Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of "de Finibus Bonorum et Malorum" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, "Lorem ipsum dolor sit amet..", comes from a line in section 1.10.32.</p><p>The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from "de Finibus Bonorum et Malorum" by Cicero are also reproduced in their exact original form, accompanied by English versions from the 1914 translation by H. Rackham.</p><h2>Where can I get some?</h2><p>There are many variations of pas</p>',
    },
  },
  {
    id: 'd45c7d37-1faa-4052-a7d6-5dc73bd055e6',
    type: 'Task',
    href: 'http://localhost:8585/api/v1/feed/d45c7d37-1faa-4052-a7d6-5dc73bd055e6',
    threadTs: 1741339066898,
    about:
      '<#E::testCase::sample_data.ecommerce_db.shopify.dim_address.zip.column_values_to_be_between>',
    entityRef: {
      id: 'f12e54c8-0834-4e3d-bb29-6c87afc9c5e5',
      type: 'testCase',
      name: 'column_values_to_be_between',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address.zip.column_values_to_be_between',
      description: 'test the number of column in table is between x and y',
      displayName: 'column_values_to_be_between',
      deleted: false,
    },
    generatedBy: 'user',
    cardStyle: 'default',
    fieldOperation: 'updated',
    createdBy: 'admin',
    updatedAt: 1741339066898,
    updatedBy: 'admin',
    resolved: false,
    message: 'New Incident',
    postsCount: 0,
    posts: [],
    task: {
      id: 16,
      type: 'RequestTestCaseFailureResolution',
      assignees: [
        {
          id: 'bd480e8b-ec8e-4694-945c-46571c3b334e',
          type: 'user',
          name: 'admin',
          fullyQualifiedName: 'admin',
          displayName: 'admin',
          deleted: false,
        },
      ],
      status: 'Open',
      testCaseResolutionStatusId: '3dc65306-5bfc-4736-96ff-931a349b8e26',
    },
  },
  {
    id: '2c963236-88ec-4174-9fea-fbcdfc47ede9',
    type: 'Task',
    href: 'http://localhost:8585/api/v1/feed/2c963236-88ec-4174-9fea-fbcdfc47ede9',
    threadTs: 1741339065268,
    about:
      '<#E::testCase::sample_data.ecommerce_db.shopify.dim_address.table_column_count_between>',
    entityRef: {
      id: '9a5890fd-d65b-4632-8fae-0f451244851b',
      type: 'testCase',
      name: 'table_column_count_between',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address.table_column_count_between',
      description: 'test the number of column in table is between x and y',
      displayName: 'table_column_count_between',
      deleted: false,
    },
    generatedBy: 'user',
    cardStyle: 'default',
    fieldOperation: 'updated',
    createdBy: 'admin',
    updatedAt: 1741339065418,
    updatedBy: 'admin',
    resolved: false,
    message: 'New Incident',
    postsCount: 0,
    posts: [],
    task: {
      id: 10,
      type: 'RequestTestCaseFailureResolution',
      assignees: [
        {
          id: 'f5c55b20-6b45-43cd-9104-5cbd85f8664f',
          type: 'user',
          name: 'aaron_johnson0',
          fullyQualifiedName: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          deleted: false,
        },
      ],
      status: 'Open',
      testCaseResolutionStatusId: 'f1b2061b-bfe0-4bf8-8962-7d3389f71702',
    },
  },
];

export const PlaygroundPage = () => {
  const { t } = useTranslation();

  return (
    <PageLayoutV1 className="playground-page" pageTitle={t('label.my-data')}>
      <Row className="activity-feed-tab" gutter={[20, 20]}>
        <Col span={24}>
          <Tabs
            items={[
              {
                label: 'Activity',
                key: 'activity',
              },
              {
                label: 'Tasks',
                key: 'tasks',
              },
              {
                label: 'My Data',
                key: 'my-data',
              },
              {
                label: 'Following',
                key: 'following',
              },
              {
                label: 'Access Token',
                key: 'access-token',
              },
            ]}
          />
        </Col>
        <Col
          className="feed-container center-container"
          id="feed-panel"
          span={12}>
          {TASKS.map((feed) => (
            <Button
              block
              className={classNames('activity-feed-card-container')}
              data-testid="message-container"
              key={feed.id}
              type="text">
              <TaskFeedCard
                isActive
                feed={feed as Thread}
                hidePopover={false}
                post={
                  {
                    message: feed.message,
                    postTs: feed.threadTs,
                    from: feed.createdBy,
                    id: feed.id,
                    reactions: [],
                  } as Post
                }
                onAfterClose={noop}
                onUpdateEntityDetails={noop}
              />
            </Button>
          ))}
        </Col>
        <Col span={12}>
          <Card title="Typography Headings">
            <Typography.Title level={5}>Personal Information</Typography.Title>
            <Typography.Title level={4}>Persona</Typography.Title>
            <Typography.Title level={3}>Domain</Typography.Title>
            <Typography.Title level={2}>Organization</Typography.Title>
            <Typography.Title level={1}>Owner</Typography.Title>
          </Card>
          <Card className="mt-5" title="Typography text">
            <p>
              <Typography.Text>
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
                Quisquam, quos.
              </Typography.Text>
            </p>
            <p>
              <Typography.Text type="secondary">Secondary</Typography.Text>
            </p>
            <p>
              <Typography.Text type="danger">Danger</Typography.Text>
            </p>
            <p>
              <Typography.Text type="warning">Warning</Typography.Text>
            </p>
            <p>
              <Typography.Text type="success">Success</Typography.Text>
            </p>
          </Card>
          <Card className="mt-5" title="Buttons">
            <Space direction="vertical" size={8}>
              <Button>Default</Button>
              <Button type="primary">Primary</Button>
              <Button type="link">Link</Button>
              <Button type="text">Text</Button>
              <Button type="dashed">Dashed</Button>

              <Button size="small">Small</Button>
              <Button size="middle">Middle</Button>
              <Button size="large">Large</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};
