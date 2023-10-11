/*
 *  Copyright 2023 Collate.
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
import { Button, Row, Tabs } from 'antd';
import Col from 'antd/es/grid/col';
import { compare } from 'fast-json-patch';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import DescriptionV1 from '../../../components/common/description/DescriptionV1';
import ManageButton from '../../../components/common/entityPageInfo/ManageButton/ManageButton';
import { UserSelectableList } from '../../../components/common/UserSelectableList/UserSelectableList.component';
import PageLayoutV1 from '../../../components/containers/PageLayoutV1';
import PageHeader from '../../../components/header/PageHeader.component';
import Loader from '../../../components/Loader/Loader';
import { EntityName } from '../../../components/Modals/EntityNameModal/EntityNameModal.interface';
import { usePermissionProvider } from '../../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../components/PermissionProvider/PermissionProvider.interface';
import { UsersTab } from '../../../components/Users/UsersTab/UsersTabs.component';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Persona } from '../../../generated/entity/teams/persona';
import { getPersonaByName, updatePersona } from '../../../rest/PersonaAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getSettingPath } from '../../../utils/RouterUtils';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

export const PersonaDetailsPage = () => {
  const { fqn } = useParams<{ fqn: string }>();
  const history = useHistory();
  const [personaDetails, setPersonaDetails] = useState<Persona>();
  const [isLoading, setIsLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const { t } = useTranslation();
  const [entityPermission, setEntityPermission] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermissionByFqn } = usePermissionProvider();

  useEffect(() => {
    getEntityPermissionByFqn(ResourceEntity.PERSONA, fqn).then(
      setEntityPermission
    );
  }, []);

  const fetchPersonaDetails = async () => {
    try {
      setIsLoading(true);
      const persona = await getPersonaByName(getEncodedFqn(fqn));
      setPersonaDetails(persona);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (fqn) {
      fetchPersonaDetails();
    }
  }, [fqn]);

  const handleDescriptionUpdate = async (description: string) => {
    if (!personaDetails) {
      return;
    }
    const updatedData = { ...personaDetails, description };
    const diff = compare(personaDetails, updatedData);

    try {
      const response = await updatePersona(personaDetails?.id, diff);
      setPersonaDetails(response);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsEdit(false);
    }
  };

  const handleDisplayNameUpdate = async (data: EntityName) => {
    if (!personaDetails) {
      return;
    }
    const updatedData = { ...personaDetails, ...data };
    const diff = compare(personaDetails, updatedData);

    try {
      const response = await updatePersona(personaDetails?.id, diff);
      setPersonaDetails(response);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsEdit(false);
    }
  };

  const handleRestorePersona = async () => {
    if (!personaDetails) {
      return;
    }
    const updatedData = { ...personaDetails };
    const diff = compare(personaDetails, updatedData);

    try {
      const response = await updatePersona(personaDetails?.id, diff);
      setPersonaDetails(response);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsEdit(false);
    }
  };

  const handlePersonaUpdate = useCallback(
    async (data: Partial<Persona>) => {
      if (!personaDetails) {
        return;
      }
      const diff = compare(personaDetails, { ...personaDetails, ...data });

      try {
        const response = await updatePersona(personaDetails?.id, diff);
        setPersonaDetails(response);
      } catch (error) {
        showErrorToast(error);
      } finally {
        setIsEdit(false);
      }
    },
    [personaDetails]
  );

  const handleRemoveUser = useCallback(
    (userId: string) => {
      const updatedUsers = personaDetails?.users?.filter(
        (user) => user.id !== userId
      );

      handlePersonaUpdate({ users: updatedUsers });
    },
    [personaDetails]
  );

  const handleAfterDeleteAction = () => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.MEMBERS,
        GlobalSettingOptions.PERSONA
      )
    );
  };

  if (isLoading || !personaDetails) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={personaDetails.name}>
      <Row className="m-b-md" gutter={[16, 16]}>
        <Col span={24}>
          <div className="d-flex justify-between items-start">
            <PageHeader
              data={{
                header: personaDetails.displayName,
                subHeader: personaDetails.name,
              }}
            />
            <ManageButton
              afterDeleteAction={handleAfterDeleteAction}
              allowSoftDelete={false}
              canDelete={entityPermission.EditAll || entityPermission.Delete}
              deleted={false}
              displayName={personaDetails.displayName}
              editDisplayNamePermission={
                entityPermission.EditAll || entityPermission.EditDescription
              }
              entityFQN={personaDetails.fullyQualifiedName}
              entityId={personaDetails.id}
              entityName={personaDetails.name}
              entityType={EntityType.PERSONA}
              onEditDisplayName={handleDisplayNameUpdate}
              onRestoreEntity={handleRestorePersona}
            />
          </div>
        </Col>
        <Col span={24}>
          <DescriptionV1
            hasEditAccess
            description={personaDetails.description}
            entityType={EntityType.PERSONA}
            isEdit={isEdit}
            showCommentsIcon={false}
            onCancel={() => setIsEdit(false)}
            onDescriptionEdit={() => setIsEdit(true)}
            onDescriptionUpdate={handleDescriptionUpdate}
          />
        </Col>
        <Col span={24}>
          <Tabs
            defaultActiveKey="users"
            items={[
              {
                label: 'Users',
                key: 'users',
                children: (
                  <UsersTab
                    users={personaDetails.users ?? []}
                    onRemoveUser={handleRemoveUser}
                  />
                ),
              },
            ]}
            tabBarExtraContent={
              <UserSelectableList
                hasPermission
                multiSelect
                selectedUsers={personaDetails.users ?? []}
                onUpdate={(users) => handlePersonaUpdate({ users })}>
                <Button size="small" type="primary">
                  {t('label.add-entity', { entity: t('label.user') })}
                </Button>
              </UserSelectableList>
            }
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};
