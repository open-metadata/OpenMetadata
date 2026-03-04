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

import { Divider, Typography, Tooltip } from 'antd';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InheritIcon } from '../../../../assets/svg/ic-inherit.svg';
import { ReactComponent as PersonaIcon } from '../../../../assets/svg/ic-persona.svg';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference, User } from '../../../../generated/entity/teams/user';
import { useAuth } from '../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useFqn } from '../../../../hooks/useFqn';
import Chip from '../../../common/Chip/Chip.component';
import { PersonaSelectableList } from '../../../MyData/Persona/PersonaSelectableList/PersonaSelectableList.component';
import '../users.less';

interface UserProfileProps {
  userData: User;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}
const UserProfilePersonas = ({
  userData,
  updateUserDetails,
}: UserProfileProps) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { fqn: username } = useFqn();
  const { currentUser } = useApplicationStore();
  const handlePersonaUpdate = useCallback(
    async (personas: EntityReference[]) => {
      await updateUserDetails({ personas }, 'personas');

      return personas;
    },
    [updateUserDetails]
  );
  const isLoggedInUser = useMemo(
    () => username === currentUser?.name,
    [username, currentUser]
  );
  const hasEditPermission = useMemo(
    () => (isAdminUser || isLoggedInUser) && !userData.deleted,
    [isAdminUser, isLoggedInUser, userData.deleted]
  );

  const activeDefaultPersona = useMemo(
    () => userData.defaultPersona ?? userData.inheritedPersonas?.[0],
    [userData]
  );

  const isInherited = useMemo(
    () => !userData.defaultPersona && !!userData.inheritedPersonas?.length,
    [userData]
  );

  const handleDefaultPersonaUpdate = useCallback(
    async (defaultPersona?: EntityReference) => {
      await updateUserDetails({ defaultPersona }, 'defaultPersona');
    },
    [updateUserDetails]
  );

  const combinedPersonas = useMemo(() => {
    const personas = userData.personas ?? [];
    const inheritedPersonas = userData.inheritedPersonas ?? [];
    const allPersonas = [...personas, ...inheritedPersonas];

    if (userData.defaultPersona) {
      allPersonas.push(userData.defaultPersona);
    }

    // Deduplicate by id
    const uniquePersonasMap = new Map();
    allPersonas.forEach((p) => uniquePersonasMap.set(p.id, p));

    return Array.from(uniquePersonasMap.values());
  }, [userData.personas, userData.inheritedPersonas, userData.defaultPersona]);

  const defaultPersonaRender = useMemo(
    () => (
      <>
        <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
          <div
            className="d-flex flex-center"
            style={{ width: '16px', margin: '2px', cursor: 'pointer' }}>
            <PersonaIcon height={16} />
          </div>
          <div className="d-flex justify-between w-full">
            <Typography.Text
              className="text-sm font-medium"
              data-testid="persona-list">
              {t('label.default-persona')}
            </Typography.Text>
            <PersonaSelectableList
              isDefaultPersona
              hasPermission={hasEditPermission}
              multiSelect={false}
              personaList={combinedPersonas}
              selectedPersonas={userData.defaultPersona ? [userData.defaultPersona] : []}
              onUpdate={handleDefaultPersonaUpdate}
            />
          </div>
        </div>
        <div
          className="user-profile-card-body default-persona-text ml-8 d-flex items-center gap-2"
          data-testid="default-persona-chip">
          <Chip
            showNoDataPlaceholder
            data={activeDefaultPersona ? [activeDefaultPersona] : []}
            entityType={EntityType.PERSONA}
            noDataPlaceholder={t('message.no-default-persona')}
          />
          {isInherited && activeDefaultPersona && (
            <Tooltip
              title={t('label.inherited-entity', {
                entity: t('label.persona'),
              })}>
              <InheritIcon
                className="inherit-icon cursor-pointer color-grey-muted"
                width={14}
              />
            </Tooltip>
          )}
        </div>
      </>
    ),
    [
      activeDefaultPersona,
      isInherited,
      userData,
      hasEditPermission,
      combinedPersonas,
      handleDefaultPersonaUpdate,
      t,
    ]
  );

  return (
    <div
      className="d-flex flex-col mb-4 w-full  p-[20px] user-profile-card"
      data-testid="persona-details-card">
      <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
        <div className="d-flex flex-center user-page-icon cursor-pointer">
          <PersonaIcon height={16} style={{ paddingLeft: '2px' }} />
        </div>
        <div className="d-flex justify-between w-full">
          <Typography.Text
            className="text-sm font-medium"
            data-testid="persona-list">
            {t('label.persona')}
          </Typography.Text>
          <PersonaSelectableList
            multiSelect
            hasPermission={Boolean(isAdminUser) && !userData.deleted}
            isDefaultPersona={false}
            selectedPersonas={userData.personas ?? []}
            onUpdate={handlePersonaUpdate}
          />
        </div>
      </div>
      <div className="user-profile-card-body d-flex justify-start gap-2">
        <div className="d-flex flex-center user-page-icon">
          <Divider
            style={{
              height: '100%',
              width: '1px',
              background: '#D9D9D9',
            }}
            type="vertical"
          />
        </div>

        <Chip
          showNoDataPlaceholder
          data={userData.personas ?? []}
          entityType={EntityType.PERSONA}
          noDataPlaceholder={t('message.no-persona-assigned')}
        />
      </div>

      {/** Default persona**/}
      {defaultPersonaRender}
    </div>
  );
};

export default UserProfilePersonas;
