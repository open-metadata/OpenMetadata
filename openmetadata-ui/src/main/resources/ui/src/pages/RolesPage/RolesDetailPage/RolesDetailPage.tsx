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

import Icon from '@ant-design/icons';
import { Button, Card, Col, Modal, Row, Tabs, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import RoleIcon from '../../../assets/svg/role-colored.svg?react';
import DescriptionV1 from '../../../components/common/EntityDescription/DescriptionV1';
import ManageButton from '../../../components/common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
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
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Role } from '../../../generated/entity/teams/role';
import { EntityReference } from '../../../generated/type/entityReference';
import { useFqn } from '../../../hooks/useFqn';
import { getRoleByName, patchRole } from '../../../rest/rolesAPIV1';
import { getTeamByName, patchTeamDetail } from '../../../rest/teamsAPI';
import { getUserByName, updateUserDetail } from '../../../rest/userAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import AddAttributeModal from '../AddAttributeModal/AddAttributeModal';
import RolesDetailPageList from './RolesDetailPageList.component';

type Attribute = 'policies' | 'teams' | 'users';

interface AddAttribute {
  type: EntityType;
  selectedData: EntityReference[];
}

const RolesDetailPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const [role, setRole] = useState<Role>({} as Role);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isLoadingOnSave, setIsLoadingOnSave] = useState(false);
  const [selectedEntity, setEntity] =
    useState<{ attribute: Attribute; record: EntityReference }>();

  const [addAttribute, setAddAttribute] = useState<AddAttribute>();
  const [rolePermission, setRolePermission] =
    useState<OperationPermission | null>(null);

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

  const {
    editDisplayNamePermission,
    hasDeletePermission,
    viewBasicPermission,
  } = useMemo(() => {
    const editDisplayNamePermission =
      rolePermission?.EditAll || rolePermission?.EditDisplayName;
    const hasDeletePermission = rolePermission?.Delete;
    const viewBasicPermission =
      rolePermission?.ViewAll || rolePermission?.ViewBasic;

    return {
      editDisplayNamePermission,
      hasDeletePermission,
      viewBasicPermission,
    };
  }, [rolePermission]);

  const fetchRolePermission = useCallback(
    async (fqn: string) => {
      try {
        const response = await getEntityPermissionByFqn(
          ResourceEntity.ROLE,
          fqn
        );
        setRolePermission(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [getEntityPermissionByFqn, setRolePermission]
  );

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
    }
  };

  const handleDisplayNameUpdate = async (entityName?: EntityName) => {
    try {
      if (role) {
        const updatedRole = {
          ...role,
          ...entityName,
        };
        const jsonPatch = compare(role, updatedRole);

        if (jsonPatch.length && role.id) {
          const response = await patchRole(jsonPatch, role.id);

          setRole(response);
        }
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
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

        return existingData ?? { id, type: addAttribute.type };
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

  const init = async () => {
    if (!fqn) {
      return;
    }
    await fetchRolePermission(fqn);
    if (viewBasicPermission) {
      fetchRole();
    }
  };

  const tabItems = useMemo(() => {
    return [
      {
        key: 'policies',
        label: t('label.policy-plural'),
        children: (
          <Card>
            <div className="flex justify-end m-b-md">
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
            </div>

            <RolesDetailPageList
              hasAccess
              list={role.policies ?? []}
              type="policy"
              onDelete={(record) =>
                setEntity({ record, attribute: 'policies' })
              }
            />
          </Card>
        ),
      },
      {
        key: 'teams',
        label: t('label.team-plural'),
        children: (
          <RolesDetailPageList
            hasAccess
            list={role.teams ?? []}
            type="team"
            onDelete={(record) => setEntity({ record, attribute: 'teams' })}
          />
        ),
      },
      {
        key: 'users',
        label: t('label.user-plural'),
        children: (
          <RolesDetailPageList
            hasAccess
            list={role.users ?? []}
            type="user"
            onDelete={(record) => setEntity({ record, attribute: 'users' })}
          />
        ),
      },
    ];
  }, [role]);

  useEffect(() => {
    init();
  }, [fqn, rolePermission]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.role'),
      })}>
      <div data-testid="role-details-container">
        <TitleBreadcrumb titleLinks={breadcrumb} />

        {isEmpty(role) ? (
          <ErrorPlaceHolder
            className="h-min-80 border-none"
            type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
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
                onClick={() => navigate(rolesPath)}>
                {t('label.go-back')}
              </Button>
            </div>
          </ErrorPlaceHolder>
        ) : (
          <>
            <Row className="flex justify-between">
              <Col span={23}>
                <EntityHeaderTitle
                  className="w-max-full"
                  displayName={role.displayName}
                  icon={
                    <Icon
                      className="align-middle p-y-xss"
                      component={RoleIcon}
                      style={{
                        fontSize: '50px',
                      }}
                    />
                  }
                  name={role?.name ?? ''}
                  serviceName="role"
                />
              </Col>
              <Col span={1}>
                <ManageButton
                  isRecursiveDelete
                  afterDeleteAction={() => navigate(rolesPath)}
                  allowSoftDelete={false}
                  canDelete={hasDeletePermission}
                  displayName={role?.displayName}
                  editDisplayNamePermission={editDisplayNamePermission}
                  entityFQN={role?.fullyQualifiedName}
                  entityId={role?.id}
                  entityName={role.name}
                  entityType={EntityType.ROLE}
                  onEditDisplayName={handleDisplayNameUpdate}
                />
              </Col>
            </Row>

            <DescriptionV1
              hasEditAccess
              className="m-y-md"
              description={role.description || ''}
              entityName={roleName}
              entityType={EntityType.ROLE}
              showCommentsIcon={false}
              onDescriptionUpdate={handleDescriptionUpdate}
            />

            <Tabs
              className="tabs-new"
              data-testid="tabs"
              defaultActiveKey="policies"
              items={tabItems}
            />
          </>
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
      </div>
    </PageLayoutV1>
  );
};

export default RolesDetailPage;
