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

import { Button, Modal, Space, Tabs, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import Description from 'components/common/description/Description';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getRoleByName, patchRole } from 'rest/rolesAPIV1';
import { getTeamByName, patchTeamDetail } from 'rest/teamsAPI';
import { getUserByName, updateUserDetail } from 'rest/userAPI';
import { getEntityName } from 'utils/EntityUtils';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Role } from '../../../generated/entity/teams/role';
import { EntityReference } from '../../../generated/type/entityReference';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import AddAttributeModal from '../AddAttributeModal/AddAttributeModal';
import './RolesDetail.less';
import RolesDetailPageList from './RolesDetailPageList.component';

const { TabPane } = Tabs;

type Attribute = 'policies' | 'teams' | 'users';

interface AddAttribute {
  type: EntityType;
  selectedData: EntityReference[];
}

const RolesDetailPage = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { fqn } = useParams<{ fqn: string }>();

  const [role, setRole] = useState<Role>({} as Role);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isLoadingOnSave, setIsLoadingOnSave] = useState(false);
  const [editDescription, setEditDescription] = useState<boolean>(false);
  const [selectedEntity, setEntity] =
    useState<{ attribute: Attribute; record: EntityReference }>();

  const [addAttribute, setAddAttribute] = useState<AddAttribute>();

  const [rolePermission, setRolePermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const rolesPath = getSettingPath(
    GlobalSettingsMenuCategory.ACCESS,
    GlobalSettingOptions.ROLES
  );

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.role-plural'),
        url: rolesPath,
      },
      {
        name: fqn,
        url: '',
      },
    ],
    [fqn]
  );

  const fetchRolePermission = async () => {
    setLoading(true);
    try {
      const response = await getEntityPermissionByFqn(ResourceEntity.ROLE, fqn);
      setRolePermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const fetchRole = async () => {
    setLoading(true);
    try {
      const data = await getRoleByName(fqn, 'policies,teams,users');
      setRole(data ?? ({} as Role));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const handleDescriptionUpdate = async (description: string) => {
    const patch = compare(role, { ...role, description });
    try {
      const data = await patchRole(patch, role.id);
      setRole({ ...role, description: data.description });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setEditDescription(false);
    }
  };

  const handleTeamsUpdate = async (data: EntityReference) => {
    try {
      const team = await getTeamByName(
        data.fullyQualifiedName || '',
        'defaultRoles'
      );
      const updatedAttributeData = (team.defaultRoles ?? []).filter(
        (attrData) => attrData.id !== role.id
      );

      const patch = compare(team, {
        ...team,
        defaultRoles: updatedAttributeData,
      });

      const response = await patchTeamDetail(team.id, patch);

      if (response) {
        const updatedTeams = (role.teams ?? []).filter(
          (team) => team.id !== data.id
        );
        setRole((prev) => ({ ...prev, teams: updatedTeams }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingOnSave(false);
    }
  };

  const handleUsersUpdate = async (data: EntityReference) => {
    try {
      const user = await getUserByName(data.fullyQualifiedName || '', 'roles');
      const updatedAttributeData = (user.roles ?? []).filter(
        (attrData) => attrData.id !== role.id
      );

      const patch = compare(user, {
        ...user,
        roles: updatedAttributeData,
      });

      const response = await updateUserDetail(user.id, patch);

      if (response) {
        const updatedUsers = (role.users ?? []).filter(
          (user) => user.id !== data.id
        );
        setRole((prev) => ({ ...prev, users: updatedUsers }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingOnSave(false);
    }
  };

  const handleDelete = async (data: EntityReference, attribute: Attribute) => {
    setIsLoadingOnSave(true);
    if (attribute === 'teams') {
      handleTeamsUpdate(data);
    } else if (attribute === 'users') {
      handleUsersUpdate(data);
    } else {
      const attributeData =
        (role[attribute as keyof Role] as EntityReference[]) ?? [];
      const updatedAttributeData = attributeData.filter(
        (attrData) => attrData.id !== data.id
      );

      const patch = compare(role, {
        ...role,
        [attribute as keyof Role]: updatedAttributeData,
      });
      try {
        const data = await patchRole(patch, role.id);
        setRole(data);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoadingOnSave(false);
      }
    }
  };

  const handleAddAttribute = async (selectedIds: string[]) => {
    if (addAttribute) {
      setIsLoadingOnSave(true);
      const updatedPolicies = selectedIds.map((id) => {
        const existingData = addAttribute.selectedData.find(
          (data) => data.id === id
        );

        return existingData ? existingData : { id, type: addAttribute.type };
      });
      const patch = compare(role, { ...role, policies: updatedPolicies });
      try {
        const data = await patchRole(patch, role.id);
        setRole(data);
        setAddAttribute(undefined);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoadingOnSave(false);
      }
    }
  };

  useEffect(() => {
    fetchRolePermission();
  }, [fqn]);

  useEffect(() => {
    if (rolePermission.ViewAll || rolePermission.ViewBasic) {
      fetchRole();
    }
  }, [rolePermission, fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div data-testid="role-details-container">
      <TitleBreadcrumb titleLinks={breadcrumb} />
      {rolePermission.ViewAll || rolePermission.ViewBasic ? (
        <>
          {isEmpty(role) ? (
            <ErrorPlaceHolder dataTestId="no-data">
              <div className="text-center">
                <p>
                  {t('message.no-entity-found-for-name', {
                    entity: t('label.role-lowercase'),
                    name: fqn,
                  })}
                </p>
                <Button
                  className="m-t-sm"
                  size="small"
                  type="primary"
                  onClick={() => history.push(rolesPath)}>
                  {t('label.go-back')}
                </Button>
              </div>
            </ErrorPlaceHolder>
          ) : (
            <div className="roles-detail" data-testid="role-details">
              <Description
                description={role.description || ''}
                entityFqn={role.fullyQualifiedName}
                entityName={getEntityName(role)}
                entityType={EntityType.ROLE}
                hasEditAccess={
                  rolePermission.EditAll || rolePermission.EditDescription
                }
                isEdit={editDescription}
                onCancel={() => setEditDescription(false)}
                onDescriptionEdit={() => setEditDescription(true)}
                onDescriptionUpdate={handleDescriptionUpdate}
              />

              <Tabs data-testid="tabs" defaultActiveKey="policies">
                <TabPane key="policies" tab={t('label.policy-plural')}>
                  <Space className="w-full" direction="vertical">
                    <Tooltip
                      title={
                        rolePermission.EditAll
                          ? t('label.add-entity', {
                              entity: t('label.policy'),
                            })
                          : t('message.no-permission-for-action')
                      }>
                      <Button
                        data-testid="add-policy"
                        disabled={!rolePermission.EditAll}
                        type="primary"
                        onClick={() =>
                          setAddAttribute({
                            type: EntityType.POLICY,
                            selectedData: role.policies || [],
                          })
                        }>
                        {t('label.add-entity', {
                          entity: t('label.policy'),
                        })}
                      </Button>
                    </Tooltip>
                    <RolesDetailPageList
                      hasAccess={rolePermission.EditAll}
                      list={role.policies ?? []}
                      type="policy"
                      onDelete={(record) =>
                        setEntity({ record, attribute: 'policies' })
                      }
                    />
                  </Space>
                </TabPane>
                <TabPane key="teams" tab={t('label.team-plural')}>
                  <RolesDetailPageList
                    hasAccess={rolePermission.EditAll}
                    list={role.teams ?? []}
                    type="team"
                    onDelete={(record) =>
                      setEntity({ record, attribute: 'teams' })
                    }
                  />
                </TabPane>
                <TabPane key="users" tab={t('label.user-plural')}>
                  <RolesDetailPageList
                    hasAccess={rolePermission.EditAll}
                    list={role.users ?? []}
                    type="user"
                    onDelete={(record) =>
                      setEntity({ record, attribute: 'users' })
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
          confirmLoading={isLoadingOnSave}
          maskClosable={false}
          okText={t('label.confirm')}
          open={!isUndefined(selectedEntity.record)}
          title={`${t('label.remove-entity', {
            entity: getEntityName(selectedEntity.record),
          })} ${t('label.from-lowercase')} ${getEntityName(role)}`}
          onCancel={() => setEntity(undefined)}
          onOk={async () => {
            await handleDelete(selectedEntity.record, selectedEntity.attribute);
            setEntity(undefined);
          }}>
          <Typography.Text>
            {t('message.are-you-sure-you-want-to-remove-child-from-parent', {
              child: getEntityName(selectedEntity.record),
              parent: getEntityName(role),
            })}
          </Typography.Text>
        </Modal>
      )}
      {addAttribute && (
        <AddAttributeModal
          isModalLoading={isLoadingOnSave}
          isOpen={!isUndefined(addAttribute)}
          selectedKeys={addAttribute.selectedData.map((data) => data.id)}
          title={`${t('label.add')} ${addAttribute.type}`}
          type={addAttribute.type}
          onCancel={() => setAddAttribute(undefined)}
          onSave={(data) => handleAddAttribute(data)}
        />
      )}
    </div>
  );
};

export default RolesDetailPage;
