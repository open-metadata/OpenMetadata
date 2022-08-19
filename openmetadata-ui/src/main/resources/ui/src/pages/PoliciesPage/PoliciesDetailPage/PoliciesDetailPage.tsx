/*
 *  Copyright 2021 Collate
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
  Card,
  Col,
  Empty,
  Row,
  Space,
  Switch,
  Table,
  Tabs,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, uniqueId } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { getPolicyByName, patchPolicy } from '../../../axiosAPIs/rolesAPIV1';
import Description from '../../../components/common/description/Description';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import Loader from '../../../components/Loader/Loader';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/globalSettings.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Effect, Policy } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { getEntityName } from '../../../utils/CommonUtils';
import {
  getRoleWithFqnPath,
  getSettingPath,
  getTeamsWithFqnPath,
} from '../../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './PoliciesDetail.less';

const { TabPane } = Tabs;

const List = ({
  list,
  type,
}: {
  list: EntityReference[];
  type: 'role' | 'team';
}) => {
  const columns: ColumnsType<EntityReference> = useMemo(() => {
    return [
      {
        title: 'Name',
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_, record) => {
          let link = '';
          switch (type) {
            case 'role':
              link = getRoleWithFqnPath(record.fullyQualifiedName || '');

              break;
            case 'team':
              link = getTeamsWithFqnPath(record.fullyQualifiedName || '');

              break;

            default:
              break;
          }

          return (
            <Link className="hover:tw-underline tw-cursor-pointer" to={link}>
              {getEntityName(record)}
            </Link>
          );
        },
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (_, record) => (
          <RichTextEditorPreviewer markdown={record?.description || ''} />
        ),
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        width: '80px',
        key: 'actions',
        render: () => {
          return (
            <Button type="text">
              <SVGIcons alt="delete" icon={Icons.DELETE} width="18px" />
            </Button>
          );
        },
      },
    ];
  }, []);

  return (
    <Table
      className="list-table"
      columns={columns}
      dataSource={list}
      pagination={false}
      size="middle"
    />
  );
};

const PoliciesDetailPage = () => {
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();

  const [policy, setPolicy] = useState<Policy>({} as Policy);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [editDescription, setEditDescription] = useState<boolean>(false);

  const policiesPath = getSettingPath(
    GlobalSettingsMenuCategory.ACCESS,
    GlobalSettingOptions.POLICIES
  );

  const breadcrumb = useMemo(
    () => [
      {
        name: 'Policies',
        url: policiesPath,
      },
      {
        name: fqn,
        url: '',
      },
    ],
    [fqn]
  );

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const data = await getPolicyByName(fqn, 'owner,location,teams,roles');
      setPolicy(data ?? ({} as Policy));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const handleDescriptionUpdate = async (description: string) => {
    const patch = compare(policy, { ...policy, description });
    try {
      const data = await patchPolicy(patch, policy.id);
      setPolicy({ ...policy, description: data.description });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setEditDescription(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, [fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div data-testid="policy-details-container">
      <TitleBreadcrumb titleLinks={breadcrumb} />
      {isEmpty(policy) ? (
        <Empty description={`No policy found for ${fqn}`}>
          <Button
            size="small"
            type="primary"
            onClick={() => history.push(policiesPath)}>
            Go Back
          </Button>
        </Empty>
      ) : (
        <div className="policies-detail" data-testid="policy-details">
          <div className="tw--ml-5">
            <Description
              description={policy.description || ''}
              entityFqn={policy.fullyQualifiedName}
              entityName={getEntityName(policy)}
              entityType={EntityType.POLICY}
              isEdit={editDescription}
              onCancel={() => setEditDescription(false)}
              onDescriptionEdit={() => setEditDescription(true)}
              onDescriptionUpdate={handleDescriptionUpdate}
            />
          </div>
          <Tabs defaultActiveKey="rules">
            <TabPane key="rules" tab="Rules">
              {isEmpty(policy.rules) ? (
                <Empty description="No rules found" />
              ) : (
                <Row gutter={[16, 16]}>
                  {policy.rules.map((rule) => (
                    <Col key={uniqueId()} span={24}>
                      <Card>
                        <Space
                          align="baseline"
                          className="tw-w-full tw-justify-between"
                          size={4}>
                          <Typography.Paragraph className="tw-font-medium tw-text-base">
                            {rule.name}
                          </Typography.Paragraph>
                          <div>
                            <Switch
                              checked={rule.effect === Effect.Allow}
                              size="small"
                            />
                            <span className="tw-ml-1">Active</span>
                          </div>
                        </Space>

                        <div className="tw-mb-3" data-testid="description">
                          <Typography.Text className="tw-text-grey-muted">
                            Description:
                          </Typography.Text>
                          <RichTextEditorPreviewer
                            markdown={rule.description || ''}
                          />
                        </div>
                        <Space direction="vertical">
                          <Space data-testid="resources" direction="vertical">
                            <Typography.Text className="tw-text-grey-muted tw-mb-0">
                              Resources:
                            </Typography.Text>
                            <Typography.Text>
                              {rule.resources?.join(', ')}
                            </Typography.Text>
                          </Space>

                          <Space data-testid="operations" direction="vertical">
                            <Typography.Text className="tw-text-grey-muted">
                              Operations:
                            </Typography.Text>
                            <Typography.Text>
                              {rule.operations?.join(', ')}
                            </Typography.Text>
                          </Space>
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </TabPane>
            <TabPane key="roles" tab="Roles">
              <List list={policy.roles ?? []} type="role" />
            </TabPane>
            <TabPane key="teams" tab="Teams">
              {isEmpty(policy.teams) ? (
                <Empty description="No teams found" />
              ) : (
                <List list={policy.teams ?? []} type="team" />
              )}
            </TabPane>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default PoliciesDetailPage;
