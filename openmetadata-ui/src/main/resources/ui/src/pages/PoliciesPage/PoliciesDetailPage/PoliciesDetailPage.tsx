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

import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Box,
  ButtonUtility,
  Dropdown,
  Grid,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { DotsVertical } from '@openmetadata/ui-core-components/icons';
import { Button, Card, Modal } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as PolicyIcon } from '../../../assets/svg/policies-colored.svg';
import Description from '../../../components/common/EntityDescription/Description';
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
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { Rule } from '../../../generated/api/policies/createPolicy';
import { Policy } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { useEntityPermissions } from '../../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../../hooks/useFqn';
import {
  getPolicyByName,
  getRoleByName,
  patchPolicy,
  patchRole,
} from '../../../rest/rolesAPIV1';
import { getTeamByName, patchTeamDetail } from '../../../rest/teamsAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
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

  const [policy, setPolicy] = useState<Policy>({} as Policy);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isloadingOnSave, setIsloadingOnSave] = useState(false);
  const [selectedEntity, setEntity] = useState<{
    attribute: Attribute;
    record: EntityReference;
  }>();

  // Fetch-owner, by fqn. Ungated: Policy carries a `deleted` field per its generated type, but
  // the old raw expressions here never referenced it (policies aren't soft-deleted through
  // this page) — matching the ungated-site rule (TagPage.tsx/StoredProcedurePage.tsx
  // precedent, RolesDetailPage.tsx sibling), not passing `deleted` here.
  // canEditDisplayName is also an explicit-deny-wins fix, same precedent as canViewBasic
  // (Task 6 Finding 1): a field-specific deny now wins over a broader EditAll grant.
  const {
    error: permissionsError,
    canEditDisplayName: editDisplayNamePermission,
    canDelete: hasDeletePermission,
    hasViewAccess: viewBasicPermission,
  } = useEntityPermissions(ResourceEntity.POLICY, fqn, {
    enabled: Boolean(fqn),
  });

  useEffect(() => {
    if (permissionsError) {
      showErrorToast(permissionsError as AxiosError);
    }
  }, [permissionsError]);

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
      setPolicy((prev) => ({ ...prev, description: data.description }));
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
        <Dropdown.Root>
          <ButtonUtility
            color="tertiary"
            data-testid={`manage-button-${rule.name}`}
            icon={DotsVertical}
            size="xs"
            tooltip={t('label.manage-entity', {
              entity: t('label.rule'),
            })}
            tooltipPlacement="top end"
          />
          <Dropdown.Popover className="tw:w-auto">
            <Dropdown.Menu
              aria-label={t('label.manage-entity', {
                entity: t('label.rule'),
              })}
              selectionMode="none"
              onAction={(key) => {
                if (key === 'edit-button') {
                  navigate(getEditPolicyRulePath(fqn, rule.name || ''));
                } else if (key === 'delete-button') {
                  handleRuleDelete(rule);
                }
              }}>
              <Dropdown.Item
                icon={EditIcon}
                id="edit-button"
                textValue={t('label.edit')}>
                <span data-testid="edit-rule">{t('label.edit')}</span>
              </Dropdown.Item>
              <Dropdown.Item
                icon={IconDelete}
                id="delete-button"
                textValue={t('label.delete')}>
                <span data-testid="delete-rule">{t('label.delete')}</span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      );
    },
    [policy]
  );

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

            <Box
              inline
              align="stretch"
              className="layout-space w-full"
              direction="col"
              gap={5}
              itemClassName="layout-space-item">
              {policy.rules.map((rule) => (
                <Card data-testid="rule-card" key={rule.name || 'rule'}>
                  <Box
                    inline
                    align="baseline"
                    className="layout-space layout-space-horizontal w-full justify-between p-b-lg"
                    gap={2}
                    itemClassName="layout-space-item">
                    <Typography
                      className="font-medium text-base text-grey-body"
                      data-testid="rule-name">
                      {rule.name}
                    </Typography>
                    {getRuleActionElement(rule)}
                  </Box>

                  <Box
                    inline
                    align="stretch"
                    className="layout-space w-full"
                    direction="col"
                    gap={3}
                    itemClassName="layout-space-item">
                    {rule.description && (
                      <Grid
                        className="layout-row layout-grid"
                        data-testid="description">
                        <Grid.Item className="layout-column" span={2}>
                          <Typography color="secondary">
                            {`${t('label.description')}:`}
                          </Typography>
                        </Grid.Item>
                        <Grid.Item className="layout-column" span={22}>
                          <RichTextEditorPreviewerV1
                            markdown={rule.description || ''}
                          />
                        </Grid.Item>
                      </Grid>
                    )}

                    <Grid
                      className="layout-row layout-grid"
                      data-testid="resources">
                      <Grid.Item className="layout-column" span={2}>
                        <Typography className="m-b-0" color="secondary">
                          {`${t('label.resource-plural')}:`}
                        </Typography>
                      </Grid.Item>
                      <Grid.Item className="layout-column" span={22}>
                        <Typography className="text-grey-body">
                          {rule.resources
                            ?.map((resource) => startCase(resource))
                            ?.join(', ')}
                        </Typography>
                      </Grid.Item>
                    </Grid>

                    <Grid
                      className="layout-row layout-grid"
                      data-testid="operations">
                      <Grid.Item className="layout-column" span={2}>
                        <Typography color="secondary">
                          {`${t('label.operation-plural')}:`}
                        </Typography>
                      </Grid.Item>
                      <Grid.Item className="layout-column" span={22}>
                        <Typography className="text-grey-body">
                          {rule.operations?.join(', ')}
                        </Typography>
                      </Grid.Item>
                    </Grid>
                    <Grid
                      className="layout-row layout-grid"
                      data-testid="effect">
                      <Grid.Item className="layout-column" span={2}>
                        <Typography color="secondary">
                          {`${t('label.effect')}:`}
                        </Typography>
                      </Grid.Item>
                      <Grid.Item className="layout-column" span={22}>
                        <Typography className="text-grey-body">
                          {startCase(rule.effect)}
                        </Typography>
                      </Grid.Item>
                    </Grid>
                    {rule.condition && (
                      <Grid
                        className="layout-row layout-grid"
                        data-testid="condition">
                        <Grid.Item className="layout-column" span={2}>
                          <Typography color="secondary">
                            {`${t('label.condition')}:`}
                          </Typography>
                        </Grid.Item>
                        <Grid.Item className="layout-column" span={22}>
                          <code>{rule.condition}</code>
                        </Grid.Item>
                      </Grid>
                    )}
                  </Box>
                </Card>
              ))}
            </Box>
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

  // Permission fetching now lives in useEntityPermissions (above); this effect keeps the
  // old init()'s "only fetch the policy once view access is known" gate, reactive to the
  // hook's resolved viewBasicPermission instead of a same-tick local variable (which also
  // drops the old code's redundant re-fetch-permission-on-every-effect-run side effect —
  // same shape as RolesDetailPage.tsx's sibling conversion).
  useEffect(() => {
    if (fqn && viewBasicPermission) {
      fetchPolicy();
    }
  }, [fqn, viewBasicPermission]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={
        policyName ||
        t('label.entity-detail-plural', {
          entity: t('label.policy'),
        })
      }>
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
              <Box justify="between">
                <div className="tw:min-w-0 tw:flex-1">
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
                </div>
                <div>
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
                </div>
              </Box>
              <Description
                hasEditAccess
                className="m-y-md"
                description={policy.description || ''}
                entityName={policyName}
                entityType={EntityType.POLICY}
                showCommentsIcon={false}
                onDescriptionUpdate={handleDescriptionUpdate}
              />

              <Tabs className="tw:gap-3" defaultSelectedKey="rules">
                <Tabs.List size="sm" type="underline" variant="card">
                  {tabItems.map(({ key, label }) => (
                    <Tabs.Item id={key} key={key}>
                      {label}
                    </Tabs.Item>
                  ))}
                </Tabs.List>
                {tabItems.map(({ key, children }) => (
                  <Tabs.Panel
                    className="tw:rounded-xl tw:bg-primary"
                    id={key}
                    key={key}>
                    {children}
                  </Tabs.Panel>
                ))}
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
            <Typography>
              {t('message.are-you-sure-you-want-to-remove-child-from-parent', {
                child: getEntityName(selectedEntity.record),
                parent: policyName,
              })}
            </Typography>
          </Modal>
        )}
      </div>
    </PageLayoutV1>
  );
};

export default PoliciesDetailPage;
