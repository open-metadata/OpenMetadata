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

import { Divider, Typography } from 'antd';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { ReactComponent as Persona } from '../../../../assets/svg/Persona.svg';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference, User } from '../../../../generated/entity/teams/user';
import { useAuth } from '../../../../hooks/authHooks';
import Chip from '../../../common/Chip/Chip.component';
import { PersonaSelectableList } from '../../../MyData/Persona/PersonaSelectableList/PersonaSelectableList.component';
import '../users.less';

interface UserProfileProps {
  userData: User;
}
const UserProfilePersonas = ({ userData }: UserProfileProps) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const handlePersonaUpdate = useCallback(
    async (personas: EntityReference[]) => {
      // await updateUserDetails({ personas }, 'personas');
      return personas;
    },
    []
  );

  return (
    <div className="d-flex flex-col mb-4 w-full h-full p-[20px] user-profile-card">
      <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
        <Persona height={24} width={24} />
        <div className="d-flex justify-between w-full">
          <Typography.Text
            className="user-profile-card-title"
            data-testid="persona-list">
            {t('label.persona')}
          </Typography.Text>
          <PersonaSelectableList
            multiSelect
            hasPermission={Boolean(isAdminUser) && !userData.deleted}
            selectedPersonas={userData.personas ?? []}
            onUpdate={handlePersonaUpdate}
          />
        </div>
      </div>
      <div className="user-profile-card-body d-flex justify-start gap-2">
        <Divider
          style={{
            height: '100%',
            width: '1px',
            background: '#D9D9D9',
          }}
          type="vertical"
        />
        <Chip
          showNoDataPlaceholder
          data={userData.personas ?? []}
          entityType={EntityType.PERSONA}
          noDataPlaceholder={t('message.no-persona-assigned')}
        />
      </div>

      {/* <div className="d-flex  w-full grey-1 gap-2 h-full mb-4">
        <div className="d-flex flex-col h-full flex-center">
          <Persona height={20} />
          <Divider
            style={{
              minHeight: '60px',
              width: '2px',
              background: '#D9D9D9',
            }}
            type="vertical"
          />
        </div>
        <div className="d-flex flex-col w-full h-full">
          <div className="d-flex justify-between w-full">
            <Typography.Text
              className="profile-section-card-title"
              data-testid="persona-list">
              {t('label.persona')}
            </Typography.Text>
            <PersonaSelectableList
              multiSelect
              hasPermission={Boolean(isAdminUser) && !userData.deleted}
              selectedPersonas={userData.personas ?? []}
              onUpdate={handlePersonaUpdate}
            />
          </div>
          <Chip
            showNoDataPlaceholder
            data={userData.personas ?? []}
            entityType={EntityType.PERSONA}
            noDataPlaceholder={t('message.no-persona-assigned')}
          />
        </div>
      </div> */}

      {/** Default persona**/}
      <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
        <Persona fontSize={14} height={24} width={24} />
        <div className="d-flex justify-between w-full">
          <Typography.Text
            className="user-profile-card-title"
            data-testid="persona-list">
            {t('label.default-persona')}
          </Typography.Text>
          <PersonaSelectableList
            multiSelect
            hasPermission={Boolean(isAdminUser) && !userData.deleted}
            selectedPersonas={userData.personas ?? []}
            onUpdate={handlePersonaUpdate}
          />
        </div>
      </div>
      <div className="user-profile-card-body d-flex justify-start gap-2">
        <Divider
          style={{
            height: '100%',
            width: '1px',
            background: '#D9D9D9',
          }}
          type="vertical"
        />
        <Chip
          showNoDataPlaceholder
          data={userData.personas ?? []}
          entityType={EntityType.PERSONA}
          noDataPlaceholder={t('message.no-persona-assigned')}
        />
      </div>
    </div>
  );
};

export default UserProfilePersonas;
