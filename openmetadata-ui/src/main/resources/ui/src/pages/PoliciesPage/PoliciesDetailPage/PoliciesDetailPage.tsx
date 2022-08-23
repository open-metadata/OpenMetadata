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
  Collapse,
  Empty,
  Modal,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, uniqueId } from 'lodash';
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
import { Policy } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { getEntityName } from '../../../utils/CommonUtils';
import {
  getAddPolicyRulePath,
  getEditPolicyRulePath,
  getRoleWithFqnPath,
  getSettingPath,
  getTeamsWithFqnPath,
} from '../../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './PoliciesDetail.less';

const { Panel } = Collapse;

const { TabPane } = Tabs;

type Attribute = 'roles' | 'teams';

const List = ({
  list,
  type,
  onDelete,
}: {
  list: EntityReference[];
  type: 'role' | 'team';
  onDelete: (record: EntityReference) => void;
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
        render: (_, record) => {
          return (
            <Button type="text" onClick={() => onDelete(record)}>
              <SVGIcons alt="remove" icon={Icons.ICON_REMOVE} title="Remove" />
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
  const [selectedEntity, setEntity] =
    useState<{ attribute: Attribute; record: EntityReference }>();

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

  const handleDelete = async (data: EntityReference, attribute: Attribute) => {
    const attributeData =
      (policy[attribute as keyof Policy] as EntityReference[]) ?? [];
    const updatedAttributeData = attributeData.filter(
      (attrData) => attrData.id !== data.id
    );

    const patch = compare(policy, {
      ...policy,
      [attribute as keyof Policy]: updatedAttributeData,
    });
    try {
      const data = await patchPolicy(patch, policy.id);
      setPolicy(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
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
                <Space className="tw-w-full rules-tab" direction="vertical">
                  <Button
                    type="primary"
                    onClick={() => history.push(getAddPolicyRulePath(fqn))}>
                    Add Rule
                  </Button>
                  <Space className="tw-w-full" direction="vertical">
                    {policy.rules.map((rule) => (
                      <Collapse key={uniqueId()}>
                        <Panel
                          header={
                            <Space
                              className="tw-w-full"
                              direction="vertical"
                              size={4}>
                              <Space
                                align="baseline"
                                className="tw-w-full tw-justify-between"
                                size={4}>
                                <Typography.Text className="tw-font-medium tw-text-base">
                                  {rule.name}
                                </Typography.Text>
                                <Button
                                  data-testid="edit-rule"
                                  type="text"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    history.push(
                                      getEditPolicyRulePath(
                                        fqn,
                                        rule.name || ''
                                      )
                                    );
                                  }}>
                                  <SVGIcons alt="edit" icon={Icons.EDIT} />
                                </Button>
                              </Space>
                              <div
                                className="tw--ml-5"
                                data-testid="description">
                                <Typography.Text className="tw-text-grey-muted">
                                  Description:
                                </Typography.Text>
                                <RichTextEditorPreviewer
                                  markdown={rule.description || ''}
                                />
                              </div>
                            </Space>
                          }
                          key={rule.name || 'rule'}>
                          <Space direction="vertical">
                            <Space
                              data-testid="resources"
                              direction="vertical"
                              size={4}>
                              <Typography.Text className="tw-text-grey-muted tw-mb-0">
                                Resources:
                              </Typography.Text>
                              <Typography.Text>
                                {rule.resources?.join(', ')}
                              </Typography.Text>
                            </Space>

                            <Space
                              data-testid="operations"
                              direction="vertical"
                              size={4}>
                              <Typography.Text className="tw-text-grey-muted">
                                Operations:
                              </Typography.Text>
                              <Typography.Text>
                                {rule.operations?.join(', ')}
                              </Typography.Text>
                            </Space>
                            {rule.condition && (
                              <Space
                                data-testid="condition"
                                direction="vertical"
                                size={4}>
                                <Typography.Text className="tw-text-grey-muted">
                                  Condition:
                                </Typography.Text>
                                <code>{rule.condition}</code>
                              </Space>
                            )}
                          </Space>
                        </Panel>
                      </Collapse>
                    ))}
                  </Space>
                </Space>
              )}
            </TabPane>
            <TabPane key="roles" tab="Roles">
              <List
                list={policy.roles ?? []}
                type="role"
                onDelete={(record) => setEntity({ record, attribute: 'roles' })}
              />
            </TabPane>
            <TabPane key="teams" tab="Teams">
              <List
                list={policy.teams ?? []}
                type="team"
                onDelete={(record) => setEntity({ record, attribute: 'teams' })}
              />
            </TabPane>
          </Tabs>
        </div>
      )}
      {selectedEntity && (
        <Modal
          centered
          okText="Confirm"
          title={`Remove ${getEntityName(
            selectedEntity.record
          )} from ${getEntityName(policy)}`}
          visible={!isUndefined(selectedEntity.record)}
          onCancel={() => setEntity(undefined)}
          onOk={() => {
            handleDelete(selectedEntity.record, selectedEntity.attribute);
            setEntity(undefined);
          }}>
          <Typography.Text>
            Are you sure you want to remove the{' '}
            {`${getEntityName(selectedEntity.record)} from ${getEntityName(
              policy
            )}?`}
          </Typography.Text>
        </Modal>
      )}
    </div>
  );
};

export default PoliciesDetailPage;
