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

import { Divider, Typography } from '@openmetadata/ui-core-components';
import { Role as PersonaIcon } from '@openmetadata/ui-core-components/icons';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

  const activeDefaultPersona = userData.defaultPersona;

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
        <div className="tw:mb-2 tw:flex tw:w-full tw:items-center tw:justify-start tw:gap-2">
          <div className="tw:m-0.5 tw:flex tw:size-4 tw:items-center tw:justify-center">
            <PersonaIcon aria-hidden size={14} />
          </div>
          <div className="d-flex justify-between w-full">
            <Typography
              className="text-sm font-medium"
              data-testid="persona-list">
              {t('label.default-persona')}
            </Typography>
            <PersonaSelectableList
              isDefaultPersona
              hasPermission={hasEditPermission}
              multiSelect={false}
              personaList={combinedPersonas}
              selectedPersonas={
                userData.defaultPersona ? [userData.defaultPersona] : []
              }
              onUpdate={handleDefaultPersonaUpdate}
            />
          </div>
        </div>
        <div
          className="tw:mb-2.5 tw:flex tw:justify-start tw:gap-2"
          data-testid="default-persona-chip">
          <div className="tw:m-0.5 tw:flex tw:items-center tw:justify-center">
            <Divider className="tw:mx-2 tw:h-full" orientation="vertical" />
          </div>
          <Chip
            showNoDataPlaceholder
            data={activeDefaultPersona ? [activeDefaultPersona] : []}
            entityType={EntityType.PERSONA}
            noDataPlaceholder={t('message.no-default-persona')}
          />
        </div>
      </>
    ),
    [
      activeDefaultPersona,
      userData,
      hasEditPermission,
      combinedPersonas,
      handleDefaultPersonaUpdate,
      t,
    ]
  );

  return (
    <div
      className="tw:flex tw:w-full tw:flex-col tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:px-5 tw:pt-5 tw:pb-2.5 tw:mb-5"
      data-testid="persona-details-card">
      <div className="tw:mb-2 tw:flex tw:w-full tw:items-center tw:justify-start tw:gap-2">
        <div className="tw:m-0.5 tw:flex tw:size-4 tw:items-center tw:justify-center">
          <PersonaIcon aria-hidden size={14} />
        </div>
        <div className="d-flex justify-between w-full">
          <Typography
            className="text-sm font-medium"
            data-testid="persona-list">
            {t('label.persona')}
          </Typography>
          <PersonaSelectableList
            multiSelect
            hasPermission={Boolean(isAdminUser) && !userData.deleted}
            isDefaultPersona={false}
            selectedPersonas={userData.personas ?? []}
            onUpdate={handlePersonaUpdate}
          />
        </div>
      </div>
      <div className="tw:mb-2.5 tw:flex tw:justify-start tw:gap-2">
        <div className="tw:m-0.5 tw:flex tw:items-center tw:justify-center">
          <Divider className="tw:mx-2 tw:h-full" orientation="vertical" />
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
