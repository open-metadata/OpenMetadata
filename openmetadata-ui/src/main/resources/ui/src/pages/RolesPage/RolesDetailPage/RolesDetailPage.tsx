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

import {
  Button,
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
import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import RoleIcon from '../../../assets/svg/role-colored.svg';
import DeleteWidgetModal from '../../../components/common/DeleteWidget/DeleteWidgetModal';
import DescriptionV1 from '../../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import { ManageButtonItemLabel } from '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
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
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Role } from '../../../generated/entity/teams/role';
import { EntityReference } from '../../../generated/type/entityReference';
import { useFqn } from '../../../hooks/useFqn';
import { getRoleByName, patchRole } from '../../../rest/rolesAPIV1';
import { getTeamByName, patchTeamDetail } from '../../../rest/teamsAPI';
import { getUserByName, updateUserDetail } from '../../../rest/userAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import AddAttributeModal from '../AddAttributeModal/AddAttributeModal';
import './roles-detail.less';
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
  const { fqn } = useFqn();
  const { getEntityPermission } = usePermissionProvider();

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
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [showActions, setShowActions] = useState<boolean>(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);

  const rolesPath = getSettingPath(
    GlobalSettingsMenuCategory.ACCESS,
    GlobalSettingOptions.ROLES
  );

  const roleName = useMemo(() => getEntityName(role), [role]);

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.role-plural'),
        url: rolesPath,
      },
      {
        name: roleName,
        url: '',
      },
    ],
    [rolesPath, roleName]
  );

  const fetchRolePermission = async () => {
    if (role) {
      try {
        const response = await getEntityPermission(
          ResourceEntity.ROLE,
          role.id
        );
        setRolePermission(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const editDisplayNamePermission = useMemo(() => {
    return rolePermission.EditAll || rolePermission.EditDisplayName;
  }, [rolePermission]);

  const manageButtonContent: ItemType[] = [
    ...(editDisplayNamePermission
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.rename-entity', {
                  entity: t('label.role'),
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
    ...(rolePermission.Delete
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t(
                  'message.delete-entity-type-action-description',
                  {
                    entityType: t('label.role'),
                  }
                )}
                icon={DeleteIcon}
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
    let updatedDetails = cloneDeep(role);

    updatedDetails = {
      ...role,
      displayName: displayName?.trim(),
    };

    handleRoleUpdate(updatedDetails);
    setIsNameEditing(false);
  };

  const handleRoleUpdate = async (updatedData: Role) => {
    if (role) {
      const jsonPatch = compare(role, updatedData);
      try {
        const response = await patchRole(jsonPatch, role.id);
        setRole(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const handleRoleDelete = () => {
    history.push(rolesPath);
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
      const team = await getTeamByName(data.fullyQualifiedName || '', {
        fields: TabSpecificField.DEFAULT_ROLES,
      });
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
      const user = await getUserByName(data.fullyQualifiedName || '', {
        fields: TabSpecificField.ROLES,
      });
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
    fetchRole();
  }, [fqn]);

  useEffect(() => {
    if (role && role.id) {
      fetchRolePermission();
    }
  }, [role.id]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.role-plural')}>
      <div className="page-container" data-testid="role-details-container">
        <TitleBreadcrumb titleLinks={breadcrumb} />

        <>
          {isEmpty(role) ? (
            <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              <div className="text-center">
                <p>
                  {t('message.no-entity-found-for-name', {
                    entity: t('label.role'),
                    name: fqn,
                  })}
                </p>
                <Button
                  ghost
                  className="m-t-sm"
                  type="primary"
                  onClick={() => history.push(rolesPath)}>
                  {t('label.go-back')}
                </Button>
              </div>
            </ErrorPlaceHolder>
          ) : (
            <div className="roles-details" data-testid="role-details">
              <Row className="flex justify-between">
                <Col className="flex items-center gap-2">
                  <div>
                    <img
                      alt="role-icon"
                      className="align-middle"
                      data-testid="icon"
                      height={36}
                      src={RoleIcon}
                      width={32}
                    />
                  </div>
                  <div className="m-t-xs">
                    {!isEmpty(role.displayName) ? (
                      <Typography.Text
                        className="m-b-0 d-block text-grey-muted"
                        data-testid="role-header-name">
                        {role.name}
                      </Typography.Text>
                    ) : null}
                    <Typography.Text
                      className="m-b-0 d-block entity-header-display-name text-lg font-semibold"
                      data-testid="heading">
                      {role.displayName || role.name}
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
                            entity: t('label.role'),
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
                description={role.description || ''}
                entityFqn={role.fullyQualifiedName}
                entityName={roleName}
                entityType={EntityType.ROLE}
                isEdit={editDescription}
                showCommentsIcon={false}
                onCancel={() => setEditDescription(false)}
                onDescriptionEdit={() => setEditDescription(true)}
                onDescriptionUpdate={handleDescriptionUpdate}
              />

              <Tabs data-testid="tabs" defaultActiveKey="policies">
                <TabPane key="policies" tab={t('label.policy-plural')}>
                  <Space
                    className="role-detail-tab w-full"
                    direction="vertical">
                    <Button
                      data-testid="add-policy"
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

                    <RolesDetailPageList
                      hasAccess
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
                    hasAccess
                    list={role.teams ?? []}
                    type="team"
                    onDelete={(record) =>
                      setEntity({ record, attribute: 'teams' })
                    }
                  />
                </TabPane>
                <TabPane key="users" tab={t('label.user-plural')}>
                  <RolesDetailPageList
                    hasAccess
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
            })} ${t('label.from-lowercase')} ${roleName}`}
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
                parent: roleName,
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
        {role && (
          <DeleteWidgetModal
            afterDeleteAction={() => handleRoleDelete()}
            allowSoftDelete={false}
            entityId={role.id}
            entityName={getEntityName(role)}
            entityType={EntityType.ROLE}
            visible={isDelete}
            onCancel={() => {
              setIsDelete(false);
            }}
          />
        )}
        <EntityNameModal<Role>
          entity={role}
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

export default RolesDetailPage;
