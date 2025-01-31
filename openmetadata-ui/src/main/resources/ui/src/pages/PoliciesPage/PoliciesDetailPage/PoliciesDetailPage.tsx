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

import { EllipsisOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Modal,
  Row,
  Space,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty, isUndefined, startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import PolicyIcon from '../../../assets/svg/policies-colored.svg';
import DeleteWidgetModal from '../../../components/common/DeleteWidget/DeleteWidgetModal';
import DescriptionV1 from '../../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import { ManageButtonItemLabel } from '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import RichTextEditorPreviewerV1 from '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import EntityNameModal from '../../../components/Modals/EntityNameModal/EntityNameModal.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Rule } from '../../../generated/api/policies/createPolicy';
import { Policy } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { useFqn } from '../../../hooks/useFqn';
import {
  getPolicyByName,
  getRoleByName,
  patchPolicy,
  patchRole,
} from '../../../rest/rolesAPIV1';
import { getTeamByName, patchTeamDetail } from '../../../rest/teamsAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import {
  getAddPolicyRulePath,
  getEditPolicyRulePath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './policies-detail.less';
import PoliciesDetailsList from './PoliciesDetailsList.component';

const { TabPane } = Tabs;

type Attribute = 'roles' | 'teams';

const PoliciesDetailPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useFqn();
  const { getEntityPermission } = usePermissionProvider();

  const [policy, setPolicy] = useState<Policy>({} as Policy);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isloadingOnSave, setIsloadingOnSave] = useState(false);
  const [editDescription, setEditDescription] = useState<boolean>(false);
  const [selectedEntity, setEntity] =
    useState<{ attribute: Attribute; record: EntityReference }>();
  const [policyPermission, setPolicyPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [showActions, setShowActions] = useState<boolean>(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);

  const policiesPath = getSettingPath(
    GlobalSettingsMenuCategory.ACCESS,
    GlobalSettingOptions.POLICIES
  );

  const policyName = useMemo(() => getEntityName(policy), [policy]);

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.policy-plural'),
        url: policiesPath,
      },
      {
        name: policyName,
        url: '',
      },
    ],
    [policyName, policiesPath]
  );

  const fetchPolicyPermission = async () => {
    if (policy) {
      try {
        const response = await getEntityPermission(
          ResourceEntity.POLICY,
          policy.id
        );
        setPolicyPermission(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const editDisplayNamePermission = useMemo(() => {
    return policyPermission.EditAll || policyPermission.EditDisplayName;
  }, [policyPermission]);

  const manageButtonContent: ItemType[] = [
    ...(editDisplayNamePermission
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.rename-entity', {
                  entity: t('label.policy'),
                })}
                icon={EditIcon}
                id="rename-button"
                name={t('label.rename')}
              />
            ),
            key: 'rename-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsNameEditing(true);
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),
    ...(policyPermission.Delete
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t(
                  'message.delete-entity-type-action-description',
                  {
                    entityType: t('label.policy'),
                  }
                )}
                icon={IconDelete}
                id="delete-button"
                name={t('label.delete')}
              />
            ),
            key: 'delete-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsDelete(true);
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),
  ];

  const onDisplayNameSave = (obj: { name: string; displayName?: string }) => {
    const { displayName } = obj;
    let updatedDetails = cloneDeep(policy);

    updatedDetails = {
      ...policy,
      displayName: displayName?.trim(),
    };

    handlePolicyUpdate(updatedDetails);
    setIsNameEditing(false);
  };

  const handlePolicyUpdate = async (updatedData: Policy) => {
    if (policy) {
      const jsonPatch = compare(policy, updatedData);
      try {
        const response = await patchPolicy(jsonPatch, policy.id);
        setPolicy(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const handlePolicyDelete = () => {
    history.push(policiesPath);
  };

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const data = await getPolicyByName(
        fqn,
        `${TabSpecificField.OWNERS},${TabSpecificField.LOCATION},${TabSpecificField.TEAMS},${TabSpecificField.ROLES}`
      );
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

  const handleRolesUpdate = async (data: EntityReference) => {
    try {
      const role = await getRoleByName(
        data.fullyQualifiedName || '',
        'policies'
      );
      const updatedAttributeData = (role.policies ?? []).filter(
        (attrData) => attrData.id !== policy.id
      );

      const patch = compare(role, {
        ...role,
        policies: updatedAttributeData,
      });

      const response = await patchRole(patch, role.id);

      if (response) {
        const updatedRoles = (policy.roles ?? []).filter(
          (role) => role.id !== data.id
        );
        setPolicy((prev) => ({ ...prev, roles: updatedRoles }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsloadingOnSave(false);
    }
  };

  const handleTeamsUpdate = async (data: EntityReference) => {
    try {
      const team = await getTeamByName(data.fullyQualifiedName || '', {
        fields: TabSpecificField.POLICIES,
      });
      const updatedAttributeData = (team.policies ?? []).filter(
        (attrData) => attrData.id !== policy.id
      );

      const patch = compare(team, {
        ...team,
        policies: updatedAttributeData,
      });

      const response = await patchTeamDetail(team.id, patch);

      if (response) {
        const updatedTeams = (policy.teams ?? []).filter(
          (team) => team.id !== data.id
        );
        setPolicy((prev) => ({ ...prev, teams: updatedTeams }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsloadingOnSave(false);
    }
  };

  const handleDelete = async (data: EntityReference, attribute: Attribute) => {
    setIsloadingOnSave(true);
    if (attribute === 'roles') {
      handleRolesUpdate(data);
    } else if (attribute === 'teams') {
      handleTeamsUpdate(data);
    } else {
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
      } finally {
        setIsloadingOnSave(false);
      }
    }
  };

  const handleRuleDelete = async (data: Rule) => {
    const updatedRules = (policy.rules ?? []).filter(
      (rule) => rule.name !== data.name
    );

    const patch = compare(policy, { ...policy, rules: updatedRules });

    try {
      const data = await patchPolicy(patch, policy.id);
      setPolicy(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const getRuleActionElement = useCallback(
    (rule: Rule) => {
      return (
        <Dropdown
          menu={{
            items: [
              {
                label: (
                  <Space align="center" data-testid="edit-rule">
                    <Icon
                      className="align-middle"
                      component={EditIcon}
                      style={{ fontSize: '14px' }}
                    />

                    {t('label.edit')}
                  </Space>
                ),
                key: 'edit-button',
              },
              {
                label: (
                  <Space align="center" data-testid="delete-rule">
                    <Icon
                      className="align-middle"
                      component={IconDelete}
                      style={{ fontSize: '14px' }}
                    />

                    {t('label.delete')}
                  </Space>
                ),
                key: 'delete-button',
              },
            ],
            onClick: (menuInfo) => {
              if (menuInfo.key === 'edit-button') {
                history.push(getEditPolicyRulePath(fqn, rule.name || ''));
              } else if (menuInfo.key === 'delete-button') {
                handleRuleDelete(rule);
              } else {
                return;
              }
            },
          }}
          placement="bottomRight"
          trigger={['click']}>
          <Tooltip
            placement="topRight"
            title={t('label.manage-entity', {
              entity: t('label.rule'),
            })}>
            <Button
              data-testid={`manage-button-${rule.name}`}
              icon={<EllipsisOutlined className="text-grey-body" rotate={90} />}
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          </Tooltip>
        </Dropdown>
      );
    },
    [policy]
  );

  useEffect(() => {
    fetchPolicy();
  }, [fqn]);

  useEffect(() => {
    if (policy?.id) {
      fetchPolicyPermission();
    }
  }, [policy?.id]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.policy-plural')}>
      <div className="page-container" data-testid="policy-details-container">
        <TitleBreadcrumb titleLinks={breadcrumb} />

        <>
          {isEmpty(policy) ? (
            <ErrorPlaceHolder>
              <div className="text-center">
                <p>
                  {t('message.no-entity-found-for-name', {
                    entity: t('label.policy-lowercase'),
                    name: fqn,
                  })}
                </p>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => history.push(policiesPath)}>
                  {t('label.go-back')}
                </Button>
              </div>
            </ErrorPlaceHolder>
          ) : (
            <div className="policies-detail" data-testid="policy-details">
              <Row className="flex justify-between">
                <Col className="flex items-center gap-2">
                  <div>
                    <img
                      alt="policy-icon"
                      className="align-middle"
                      data-testid="icon"
                      height={36}
                      src={PolicyIcon}
                      width={32}
                    />
                  </div>
                  <div className="m-t-xs">
                    {!isEmpty(policy.displayName) ? (
                      <Typography.Text
                        className="m-b-0 d-block text-grey-muted"
                        data-testid="policy-header-name">
                        {policy.name}
                      </Typography.Text>
                    ) : null}
                    <Typography.Text
                      className="m-b-0 d-block entity-header-display-name text-lg font-semibold"
                      data-testid="heading">
                      {policyName}
                    </Typography.Text>
                  </div>
                </Col>
                <Col>
                  <ButtonGroup className="p-l-xs mt--1" size="small">
                    {manageButtonContent.length > 0 && (
                      <Dropdown
                        align={{ targetOffset: [-12, 0] }}
                        className="m-l-xs"
                        menu={{
                          items: manageButtonContent,
                        }}
                        open={showActions}
                        overlayClassName="domain-manage-dropdown-list-container"
                        overlayStyle={{ width: '350px' }}
                        placement="bottomRight"
                        trigger={['click']}
                        onOpenChange={setShowActions}>
                        <Tooltip
                          placement="topRight"
                          title={t('label.manage-entity', {
                            entity: t('label.policy'),
                          })}>
                          <Button
                            className="domain-manage-dropdown-button tw-px-1.5"
                            data-testid="manage-button"
                            icon={
                              <IconDropdown className="vertical-align-inherit manage-dropdown-icon" />
                            }
                            onClick={() => setShowActions(true)}
                          />
                        </Tooltip>
                      </Dropdown>
                    )}
                  </ButtonGroup>
                </Col>
              </Row>
              <DescriptionV1
                hasEditAccess
                className="m-y-md"
                description={policy.description || ''}
                entityFqn={policy.fullyQualifiedName}
                entityName={policyName}
                entityType={EntityType.POLICY}
                isEdit={editDescription}
                showCommentsIcon={false}
                onCancel={() => setEditDescription(false)}
                onDescriptionEdit={() => setEditDescription(true)}
                onDescriptionUpdate={handleDescriptionUpdate}
              />

              <Tabs defaultActiveKey="rules">
                <TabPane key="rules" tab={t('label.rule-plural')}>
                  {isEmpty(policy.rules) ? (
                    <ErrorPlaceHolder />
                  ) : (
                    <Space
                      className="w-full tabpane-space"
                      direction="vertical">
                      <Button
                        data-testid="add-rule"
                        type="primary"
                        onClick={() => history.push(getAddPolicyRulePath(fqn))}>
                        {t('label.add-entity', {
                          entity: t('label.rule'),
                        })}
                      </Button>

                      <Space className="w-full" direction="vertical" size={20}>
                        {policy.rules.map((rule) => (
                          <Card
                            data-testid="rule-card"
                            key={rule.name || 'rule'}>
                            <Space
                              align="baseline"
                              className="w-full justify-between p-b-lg"
                              direction="horizontal">
                              <Typography.Text
                                className="font-medium text-base text-grey-body"
                                data-testid="rule-name">
                                {rule.name}
                              </Typography.Text>
                              {getRuleActionElement(rule)}
                            </Space>

                            <Space
                              className="w-full"
                              direction="vertical"
                              size={12}>
                              {rule.description && (
                                <Row data-testid="description">
                                  <Col span={2}>
                                    <Typography.Text className="text-grey-muted">
                                      {`${t('label.description')}:`}
                                    </Typography.Text>
                                  </Col>
                                  <Col span={22}>
                                    <RichTextEditorPreviewerV1
                                      markdown={rule.description || ''}
                                    />
                                  </Col>
                                </Row>
                              )}

                              <Row data-testid="resources">
                                <Col span={2}>
                                  <Typography.Text className="text-grey-muted m-b-0">
                                    {`${t('label.resource-plural')}:`}
                                  </Typography.Text>
                                </Col>
                                <Col span={22}>
                                  <Typography.Text className="text-grey-body">
                                    {rule.resources
                                      ?.map((resource) => startCase(resource))
                                      ?.join(', ')}
                                  </Typography.Text>
                                </Col>
                              </Row>

                              <Row data-testid="operations">
                                <Col span={2}>
                                  <Typography.Text className="text-grey-muted">
                                    {`${t('label.operation-plural')}:`}
                                  </Typography.Text>
                                </Col>
                                <Col span={22}>
                                  <Typography.Text className="text-grey-body">
                                    {rule.operations?.join(', ')}
                                  </Typography.Text>
                                </Col>
                              </Row>
                              <Row data-testid="effect">
                                <Col span={2}>
                                  <Typography.Text className="text-grey-muted">
                                    {`${t('label.effect')}:`}
                                  </Typography.Text>
                                </Col>
                                <Col span={22}>
                                  <Typography.Text className="text-grey-body">
                                    {startCase(rule.effect)}
                                  </Typography.Text>
                                </Col>
                              </Row>
                              {rule.condition && (
                                <Row data-testid="condition">
                                  <Col span={2}>
                                    <Typography.Text className="text-grey-muted">
                                      {`${t('label.condition')}:`}
                                    </Typography.Text>
                                  </Col>
                                  <Col span={22}>
                                    <code>{rule.condition}</code>
                                  </Col>
                                </Row>
                              )}
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    </Space>
                  )}
                </TabPane>
                <TabPane key="roles" tab={t('label.role-plural')}>
                  <PoliciesDetailsList
                    hasAccess
                    list={policy.roles ?? []}
                    type="role"
                    onDelete={(record) =>
                      setEntity({ record, attribute: 'roles' })
                    }
                  />
                </TabPane>
                <TabPane key="teams" tab={t('label.team-plural')}>
                  <PoliciesDetailsList
                    hasAccess
                    list={policy.teams ?? []}
                    type="team"
                    onDelete={(record) =>
                      setEntity({ record, attribute: 'teams' })
                    }
                  />
                </TabPane>
              </Tabs>
            </div>
          )}
        </>

        {selectedEntity && (
          <Modal
            centered
            closable={false}
            confirmLoading={isloadingOnSave}
            maskClosable={false}
            okText={t('label.confirm')}
            open={!isUndefined(selectedEntity.record)}
            title={`${t('label.remove-entity', {
              entity: getEntityName(selectedEntity.record),
            })} ${t('label.from-lowercase')} ${policyName}`}
            onCancel={() => setEntity(undefined)}
            onOk={async () => {
              await handleDelete(
                selectedEntity.record,
                selectedEntity.attribute
              );
              setEntity(undefined);
            }}>
            <Typography.Text>
              {t('message.are-you-sure-you-want-to-remove-child-from-parent', {
                child: getEntityName(selectedEntity.record),
                parent: policyName,
              })}
            </Typography.Text>
          </Modal>
        )}
        {policy && (
          <DeleteWidgetModal
            afterDeleteAction={handlePolicyDelete}
            allowSoftDelete={false}
            entityId={policy.id}
            entityName={getEntityName(policy)}
            entityType={EntityType.POLICY}
            visible={isDelete}
            onCancel={() => {
              setIsDelete(false);
            }}
          />
        )}
        <EntityNameModal<Policy>
          entity={policy}
          title={t('label.edit-entity', {
            entity: t('label.display-name'),
          })}
          visible={isNameEditing}
          onCancel={() => setIsNameEditing(false)}
          onSave={onDisplayNameSave}
        />
      </div>
    </PageLayoutV1>
  );
};

export default PoliciesDetailPage;
