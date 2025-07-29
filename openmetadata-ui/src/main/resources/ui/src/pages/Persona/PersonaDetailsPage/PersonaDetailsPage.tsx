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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconPersona } from '../../../assets/svg/ic-personas.svg';
import DescriptionV1 from '../../../components/common/EntityDescription/DescriptionV1';
import ManageButton from '../../../components/common/EntityPageInfos/ManageButton/ManageButton';
import NoDataPlaceholder from '../../../components/common/ErrorWithPlaceholder/NoDataPlaceholder';
import Loader from '../../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { UserSelectableList } from '../../../components/common/UserSelectableList/UserSelectableList.component';
import EntityHeaderTitle from '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { CustomizeUI } from '../../../components/Settings/Persona/CustomizeUI/CustomizeUI';
import { UsersTab } from '../../../components/Settings/Users/UsersTab/UsersTabs.component';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { SIZE } from '../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Persona } from '../../../generated/entity/teams/persona';
import { Include } from '../../../generated/type/include';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../hooks/useFqn';
import { getPersonaByName, updatePersona } from '../../../rest/PersonaAPI';
import { getUserById } from '../../../rest/userAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

export const PersonaDetailsPage = () => {
  const { fqn } = useFqn();
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useApplicationStore();
  const [personaDetails, setPersonaDetails] = useState<Persona>();
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();
  const [entityPermission, setEntityPermission] = useState(
    DEFAULT_ENTITY_PERMISSION
  );
  const location = useCustomLocation();
  const { activeKey, fullHash } = useMemo(() => {
    const activeKey = (location.hash?.replace('#', '') || 'customize-ui').split(
      '.'
    )[0];

    return {
      activeKey,
      fullHash: location.hash?.replace('#', ''),
    };
  }, [location.hash]);

  const { getEntityPermissionByFqn } = usePermissionProvider();

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.persona-plural'),
        url: getSettingPath(GlobalSettingsMenuCategory.PERSONA),
      },
      {
        name: getEntityName(personaDetails),
        url: '',
      },
    ],
    [personaDetails]
  );

  useEffect(() => {
    getEntityPermissionByFqn(ResourceEntity.PERSONA, fqn).then(
      setEntityPermission
    );
  }, []);

  const fetchPersonaDetails = async () => {
    try {
      setIsLoading(true);
      const persona = await getPersonaByName(fqn);
      setPersonaDetails(persona);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (fqn) {
      fetchPersonaDetails();
    }
  }, [fqn]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      if (currentUser) {
        const user = await getUserById(currentUser.id, {
          fields: [TabSpecificField.PERSONAS],
          include: Include.All,
        });

        setCurrentUser({ ...currentUser, ...user });
      }
    } catch {
      return;
    }
  }, [currentUser, setCurrentUser]);

  const handlePersonaUpdate = useCallback(
    async (data: Partial<Persona>, shouldRefetch = false) => {
      if (!personaDetails) {
        return;
      }
      const diff = compare(personaDetails, { ...personaDetails, ...data });

      try {
        const response = await updatePersona(personaDetails?.id, diff);
        setPersonaDetails(response);
        if (shouldRefetch) {
          await fetchCurrentUser();
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [personaDetails]
  );

  const handleRemoveUser = useCallback(
    (userId: string) => {
      const updatedUsers = personaDetails?.users?.filter(
        (user) => user.id !== userId
      );

      handlePersonaUpdate({ users: updatedUsers }, true);
    },
    [personaDetails]
  );

  const handleAfterDeleteAction = async () => {
    await fetchCurrentUser();
    navigate(getSettingPath(GlobalSettingsMenuCategory.PERSONA));
  };

  const handleTabClick = useCallback(
    (key: string) => {
      if (fullHash === key) {
        return;
      }

      navigate({
        hash: key,
      });
    },
    [history, fullHash]
  );

  const tabItems = useMemo(() => {
    return [
      {
        label: t('label.customize-ui'),
        key: 'customize-ui',
        children: <CustomizeUI />,
      },
      {
        label: t('label.user-plural'),
        key: 'users',
        children: (
          <UsersTab
            users={personaDetails?.users ?? []}
            onRemoveUser={handleRemoveUser}
          />
        ),
      },
    ];
  }, [personaDetails]);

  if (isLoading) {
    return <Loader />;
  }

  if (isUndefined(personaDetails)) {
    return <NoDataPlaceholder size={SIZE.LARGE} />;
  }

  return (
    <PageLayoutV1 pageTitle={personaDetails.name}>
      <Row className="m-b-md" gutter={[0, 16]}>
        <Col span={24}>
          <div className="d-flex justify-between items-start">
            <div className="w-full">
              <TitleBreadcrumb titleLinks={breadcrumb} />

              <EntityHeaderTitle
                className="m-t-xs"
                displayName={personaDetails.displayName}
                icon={
                  <Icon component={IconPersona} style={{ fontSize: '36px' }} />
                }
                name={personaDetails?.name}
                serviceName={personaDetails.name}
              />
            </div>
            <ManageButton
              afterDeleteAction={handleAfterDeleteAction}
              allowSoftDelete={false}
              canDelete={entityPermission.EditAll || entityPermission.Delete}
              deleted={false}
              displayName={getEntityName(personaDetails)}
              editDisplayNamePermission={
                entityPermission.EditAll || entityPermission.EditDescription
              }
              entityFQN={personaDetails.fullyQualifiedName}
              entityId={personaDetails.id}
              entityName={personaDetails.name}
              entityType={EntityType.PERSONA}
              onEditDisplayName={(data) => handlePersonaUpdate(data, true)}
            />
          </div>
        </Col>
        <Col span={24}>
          <DescriptionV1
            description={personaDetails.description}
            entityName={personaDetails.name}
            entityType={EntityType.PERSONA}
            hasEditAccess={
              entityPermission.EditAll || entityPermission.EditDescription
            }
            showCommentsIcon={false}
            onDescriptionUpdate={(description) =>
              handlePersonaUpdate({ description })
            }
          />
        </Col>
        <Col span={24}>
          <Tabs
            activeKey={activeKey}
            className="tabs-new"
            items={tabItems}
            tabBarExtraContent={
              activeKey === 'users' && (
                <UserSelectableList
                  hasPermission
                  multiSelect
                  selectedUsers={personaDetails.users ?? []}
                  onUpdate={(users) => handlePersonaUpdate({ users }, true)}>
                  <Button
                    data-testid="add-persona-button"
                    size="small"
                    type="primary">
                    {t('label.add-entity', { entity: t('label.user') })}
                  </Button>
                </UserSelectableList>
              )
            }
            onTabClick={handleTabClick}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};
