/*
 *  Copyright 2026 Collate.
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
import { AxiosError } from 'axios';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../enums/entity.enum';
import { EntityReference } from '../generated/entity/type';
import { updateUserDetail } from '../rest/userAPI';
import { showErrorToast } from '../utils/ToastUtils';
import { useApplicationStore } from './useApplicationStore';
import { useDomainStore } from './useDomainStore';

/**
 * Switches the navbar domain and persists it as the user's `defaultDomain`, so the server applies
 * it to every list. `undefined` clears the selection (All Domains).
 */
export const useSwitchActiveDomain = () => {
  const navigate = useNavigate();
  const { currentUser, updateCurrentUser } = useApplicationStore();
  const { updateActiveDomain } = useDomainStore();

  return useCallback(
    async (domain?: EntityReference) => {
      updateActiveDomain(domain);
      if (currentUser?.id) {
        try {
          // JSON Patch `add` upserts, so one op covers first-set, change, and clear (null).
          const updated = await updateUserDetail(currentUser.id, [
            {
              op: 'add',
              path: '/defaultDomain',
              value: domain ? { id: domain.id, type: EntityType.DOMAIN } : null,
            },
          ]);
          updateCurrentUser(updated);
        } catch (error) {
          // The reload restores the persisted value, which would silently undo the switch.
          showErrorToast(error as AxiosError);
          updateActiveDomain(currentUser.defaultDomain);

          return;
        }
      }
      navigate(0);
    },
    [
      currentUser?.id,
      currentUser?.defaultDomain,
      navigate,
      updateActiveDomain,
      updateCurrentUser,
    ]
  );
};
