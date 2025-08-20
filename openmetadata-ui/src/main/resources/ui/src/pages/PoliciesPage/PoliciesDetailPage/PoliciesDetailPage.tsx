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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import EditIcon from '../../../assets/svg/edit-new.svg?react';
import IconDelete from '../../../assets/svg/ic-delete.svg?react';
import PolicyIcon from '../../../assets/svg/policies-colored.svg?react';
import DescriptionV1 from '../../../components/common/EntityDescription/DescriptionV1';
import ManageButton from '../../../components/common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import RichTextEditorPreviewerV1 from '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import EntityHeaderTitle from '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { EntityName } from '../../../components/Modals/EntityNameModal/EntityNameModal.interface';
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
import {
  getAddPolicyRulePath,
  getEditPolicyRulePath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import PoliciesDetailsList from './PoliciesDetailsList.component';

type Attribute = 'roles' | 'teams';

const PoliciesDetailPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const [policy, setPolicy] = useState<Policy>({} as Policy);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isloadingOnSave, setIsloadingOnSave] = useState(false);
  const [selectedEntity, setEntity] =
    useState<{ attribute: Attribute; record: EntityReference }>();
  const [policyPermission, setPolicyPermission] =
    useState<OperationPermission | null>(null);

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

  const {
    editDisplayNamePermission,
    hasDeletePermission,
    viewBasicPermission,
  } = useMemo(() => {
    const editDisplayNamePermission =
      policyPermission?.EditAll || policyPermission?.EditDisplayName;
    const hasDeletePermission = policyPermission?.Delete;
    const viewBasicPermission =
      policyPermission?.ViewAll || policyPermission?.ViewBasic;

    return {
      editDisplayNamePermission,
      hasDeletePermission,
      viewBasicPermission,
    };
  }, [policyPermission]);

  const fetchPolicyPermission = useCallback(
    async (fqn: string) => {
      try {
        const response = await getEntityPermissionByFqn(
          ResourceEntity.POLICY,
          fqn
        );
        setPolicyPermission(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [getEntityPermissionByFqn, setPolicyPermission]
  );

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
    }
  };

  const handleDisplayNameUpdate = async (entityName?: EntityName) => {
    try {
      if (policy) {
        const updatedPolicy = {
          ...policy,
          ...entityName,
        };
        const jsonPatch = compare(policy, updatedPolicy);

        if (jsonPatch.length && policy.id) {
          const response = await patchPolicy(jsonPatch, policy.id);

          setPolicy(response);
        }
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
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
                navigate(getEditPolicyRulePath(fqn, rule.name || ''));
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

  const init = async () => {
    if (!fqn) {
      return;
    }
    await fetchPolicyPermission(fqn);
    if (viewBasicPermission) {
      fetchPolicy();
    }
  };

  const rulesTab = useMemo(() => {
    return (
      <Card>
        {isEmpty(policy.rules) ? (
          <ErrorPlaceHolder className="border-none" />
        ) : (
          <>
            <div className="flex justify-end m-b-md">
              <Button
                data-testid="add-rule"
                type="primary"
                onClick={() => navigate(getAddPolicyRulePath(fqn))}>
                {t('label.add-entity', {
                  entity: t('label.rule'),
                })}
              </Button>
            </div>

            <Space className="w-full" direction="vertical" size={20}>
              {policy.rules.map((rule) => (
                <Card data-testid="rule-card" key={rule.name || 'rule'}>
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

                  <Space className="w-full" direction="vertical" size={12}>
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
          </>
        )}
      </Card>
    );
  }, [policy]);

  const tabItems = useMemo(() => {
    return [
      {
        key: 'rules',
        label: t('label.rule-plural'),
        children: rulesTab,
      },
      {
        key: 'roles',
        label: t('label.role-plural'),
        children: (
          <PoliciesDetailsList
            hasAccess
            list={policy.roles ?? []}
            type="role"
            onDelete={(record) => setEntity({ record, attribute: 'roles' })}
          />
        ),
      },
      {
        key: 'teams',
        label: t('label.team-plural'),
        children: (
          <PoliciesDetailsList
            hasAccess
            list={policy.teams ?? []}
            type="team"
            onDelete={(record) => setEntity({ record, attribute: 'teams' })}
          />
        ),
      },
    ];
  }, [rulesTab, policy]);

  useEffect(() => {
    init();
  }, [fqn, policyPermission]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.policy'),
      })}>
      <div data-testid="policy-details-container">
        <TitleBreadcrumb titleLinks={breadcrumb} />

        <>
          {isEmpty(policy) ? (
            <ErrorPlaceHolder className="border-none h-min-80">
              <div className="text-center">
                <p className="m-y-sm">
                  {t('message.no-entity-found-for-name', {
                    entity: t('label.policy-lowercase'),
                    name: fqn,
                  })}
                </p>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => navigate(policiesPath)}>
                  {t('label.go-back')}
                </Button>
              </div>
            </ErrorPlaceHolder>
          ) : (
            <div className="policies-detail" data-testid="policy-details">
              <Row className="flex justify-between">
                <Col span={23}>
                  <EntityHeaderTitle
                    className="w-max-full"
                    displayName={policy.displayName}
                    icon={
                      <Icon
                        className="align-middle p-y-xss"
                        component={PolicyIcon}
                        style={{ fontSize: '50px' }}
                      />
                    }
                    name={policy?.name ?? ''}
                    serviceName="policy"
                  />
                </Col>
                <Col span={1}>
                  <ManageButton
                    isRecursiveDelete
                    afterDeleteAction={() => navigate(policiesPath)}
                    allowSoftDelete={false}
                    canDelete={hasDeletePermission}
                    displayName={policy?.displayName}
                    editDisplayNamePermission={editDisplayNamePermission}
                    entityFQN={policy?.fullyQualifiedName}
                    entityId={policy?.id}
                    entityName={policy.name}
                    entityType={EntityType.POLICY}
                    onEditDisplayName={handleDisplayNameUpdate}
                  />
                </Col>
              </Row>
              <DescriptionV1
                hasEditAccess
                className="m-y-md"
                description={policy.description || ''}
                entityName={policyName}
                entityType={EntityType.POLICY}
                showCommentsIcon={false}
                onDescriptionUpdate={handleDescriptionUpdate}
              />

              <Tabs
                className="tabs-new"
                defaultActiveKey="rules"
                items={tabItems}
              />
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
      </div>
    </PageLayoutV1>
  );
};

export default PoliciesDetailPage;
