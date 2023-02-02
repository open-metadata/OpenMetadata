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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Menu,
  Modal,
  Row,
  Space,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import Description from 'components/common/description/Description';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  getPolicyByName,
  getRoleByName,
  patchPolicy,
  patchRole,
} from 'rest/rolesAPIV1';
import { getTeamByName, patchTeamDetail } from 'rest/teamsAPI';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Rule } from '../../../generated/api/policies/createPolicy';
import { Policy } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { getEntityName } from '../../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import {
  getAddPolicyRulePath,
  getEditPolicyRulePath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './PoliciesDetail.less';
import PoliciesDetailsList from './PoliciesDetailsList.component';

const { TabPane } = Tabs;

type Attribute = 'roles' | 'teams';

const PoliciesDetailPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const [policy, setPolicy] = useState<Policy>({} as Policy);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isloadingOnSave, setIsloadingOnSave] = useState(false);
  const [editDescription, setEditDescription] = useState<boolean>(false);
  const [selectedEntity, setEntity] =
    useState<{ attribute: Attribute; record: EntityReference }>();

  const [policyPermission, setPolicyPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const policiesPath = getSettingPath(
    GlobalSettingsMenuCategory.ACCESS,
    GlobalSettingOptions.POLICIES
  );

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.policy-plural'),
        url: policiesPath,
      },
      {
        name: fqn,
        url: '',
      },
    ],
    [fqn]
  );

  const fetchPolicyPermission = async () => {
    setLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.POLICY,
        fqn
      );
      setPolicyPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

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
      const team = await getTeamByName(
        data.fullyQualifiedName || '',
        'policies'
      );
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
          disabled={!policyPermission.EditAll}
          overlay={
            <Menu
              items={[
                {
                  label: (
                    <Button
                      className="p-0"
                      data-testid="edit-rule"
                      type="text"
                      onClick={(e) => {
                        e.stopPropagation();
                        history.push(
                          getEditPolicyRulePath(fqn, rule.name || '')
                        );
                      }}>
                      <Space align="center">
                        <SVGIcons
                          alt={t('label.edit')}
                          icon={Icons.EDIT}
                          width="16px"
                        />
                        {t('label.edit')}
                      </Space>
                    </Button>
                  ),
                  key: 'edit-button',
                },
                {
                  label: (
                    <Button
                      className="p-0"
                      data-testid="delete-rule"
                      type="text"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRuleDelete(rule);
                      }}>
                      <Space align="center">
                        <SVGIcons
                          alt={t('label.delete')}
                          icon={Icons.DELETE}
                          width="16px"
                        />
                        {t('label.delete')}
                      </Space>
                    </Button>
                  ),
                  key: 'delete-button',
                },
              ]}
            />
          }
          placement="bottomRight"
          trigger={['click']}>
          <Tooltip
            title={
              policyPermission.EditAll
                ? t('label.manage-rule')
                : t('message.no-permission-for-action')
            }>
            <Button
              data-testid={`manage-button-${rule.name}`}
              disabled={!policyPermission.EditAll}
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
              }}>
              <FontAwesomeIcon
                className="text-grey-body"
                icon="ellipsis-vertical"
              />
            </Button>
          </Tooltip>
        </Dropdown>
      );
    },
    [policy, policyPermission]
  );

  useEffect(() => {
    fetchPolicyPermission();
  }, [fqn]);

  useEffect(() => {
    if (policyPermission.ViewAll || policyPermission.ViewBasic) {
      fetchPolicy();
    }
  }, [policyPermission, fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div data-testid="policy-details-container">
      <TitleBreadcrumb titleLinks={breadcrumb} />
      {policyPermission.ViewAll || policyPermission.ViewBasic ? (
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
              <Description
                description={policy.description || ''}
                entityFqn={policy.fullyQualifiedName}
                entityName={getEntityName(policy)}
                entityType={EntityType.POLICY}
                hasEditAccess={
                  policyPermission.EditAll || policyPermission.EditDescription
                }
                isEdit={editDescription}
                onCancel={() => setEditDescription(false)}
                onDescriptionEdit={() => setEditDescription(true)}
                onDescriptionUpdate={handleDescriptionUpdate}
              />

              <Tabs defaultActiveKey="rules">
                <TabPane key="rules" tab={t('label.rules')}>
                  {isEmpty(policy.rules) ? (
                    <ErrorPlaceHolder>
                      <p>{t('message.no-rule-found')}</p>
                    </ErrorPlaceHolder>
                  ) : (
                    <Space
                      className="w-full tabpane-space"
                      direction="vertical">
                      <Tooltip
                        title={
                          policyPermission.EditAll
                            ? t('label.add-entity', {
                                entity: t('label.rule'),
                              })
                            : t('message.no-permission-for-action')
                        }>
                        <Button
                          data-testid="add-rule"
                          disabled={!policyPermission.EditAll}
                          type="primary"
                          onClick={() =>
                            history.push(getAddPolicyRulePath(fqn))
                          }>
                          {t('label.add-entity', {
                            entity: t('label.rule'),
                          })}
                        </Button>
                      </Tooltip>

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
                                      {t('label.description')} :
                                    </Typography.Text>
                                  </Col>
                                  <Col span={22}>
                                    <RichTextEditorPreviewer
                                      markdown={rule.description || ''}
                                    />
                                  </Col>
                                </Row>
                              )}

                              <Row data-testid="resources">
                                <Col span={2}>
                                  <Typography.Text className="text-grey-muted m-b-0">
                                    {t('label.resource-plural')} :
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
                                    {t('label.operation-plural')} :
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
                                    {t('label.effect')} :
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
                                      {t('label.condition')} :
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
                    hasAccess={policyPermission.EditAll}
                    list={policy.roles ?? []}
                    type="role"
                    onDelete={(record) =>
                      setEntity({ record, attribute: 'roles' })
                    }
                  />
                </TabPane>
                <TabPane key="teams" tab={t('label.team-plural')}>
                  <PoliciesDetailsList
                    hasAccess={policyPermission.EditAll}
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
      ) : (
        <ErrorPlaceHolder>
          {t('message.no-permission-to-view')}
        </ErrorPlaceHolder>
      )}
      {selectedEntity && (
        <Modal
          centered
          closable={false}
          confirmLoading={isloadingOnSave}
          okText={t('label.confirm')}
          open={!isUndefined(selectedEntity.record)}
          title={`${t('label.remove-entity', {
            entity: getEntityName(selectedEntity.record),
          })} ${t('label.from-lowercase')} ${getEntityName(policy)}`}
          onCancel={() => setEntity(undefined)}
          onOk={async () => {
            await handleDelete(selectedEntity.record, selectedEntity.attribute);
            setEntity(undefined);
          }}>
          <Typography.Text>
            {t('message.are-you-sure-you-want-to-remove-child-from-parent', {
              child: getEntityName(selectedEntity.record),
              parent: getEntityName(policy),
            })}
          </Typography.Text>
        </Modal>
      )}
    </div>
  );
};

export default PoliciesDetailPage;
