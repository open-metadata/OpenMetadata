/*
 *  Copyright 2024 Collate.
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
import { LOCAL_STORAGE_AUTO_PILOT_STATUS } from '../constants/LocalStorage.constants';
import { OM_SESSION_KEY } from '../hooks/useApplicationStore';
import { AutoPilotStatus } from './LocalStorageUtils.interface';

export const getOidcToken = (): string => {
  return (
    JSON.parse(localStorage.getItem(OM_SESSION_KEY) ?? '{}')?.oidcIdToken ?? ''
  );
};

export const setOidcToken = (token: string) => {
  const session = JSON.parse(localStorage.getItem(OM_SESSION_KEY) ?? '{}');

  session.oidcIdToken = token;
  localStorage.setItem(OM_SESSION_KEY, JSON.stringify(session));
};

export const getRefreshToken = (): string => {
  return (
    JSON.parse(localStorage.getItem(OM_SESSION_KEY) ?? '{}')?.refreshTokenKey ??
    ''
  );
};

export const setRefreshToken = (token: string) => {
  const session = JSON.parse(localStorage.getItem(OM_SESSION_KEY) ?? '{}');

  session.refreshTokenKey = token;
  localStorage.setItem(OM_SESSION_KEY, JSON.stringify(session));
};

export const getAutoPilotStatuses = (): Array<AutoPilotStatus> => {
  return JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_AUTO_PILOT_STATUS) ?? '[]'
  );
};

export const updateAutoPilotStatus = (workflowStatus: AutoPilotStatus) => {
  const currentStatuses = getAutoPilotStatuses();
  // Remove the status if it already exists for the serviceFQN
  const filteredStatuses = currentStatuses.filter(
    (status) => status.serviceFQN !== workflowStatus.serviceFQN
  );
  // Add the new status
  const updatedStatuses: Array<AutoPilotStatus> = [
    ...filteredStatuses,
    workflowStatus,
  ];

  localStorage.setItem(
    LOCAL_STORAGE_AUTO_PILOT_STATUS,
    JSON.stringify(updatedStatuses)
  );
};

export const removeAutoPilotStatus = (serviceFQN: string) => {
  const currentStatuses = getAutoPilotStatuses();
  const filteredStatuses = currentStatuses.filter(
    (status) => status.serviceFQN !== serviceFQN
  );
  localStorage.setItem(
    LOCAL_STORAGE_AUTO_PILOT_STATUS,
    JSON.stringify(filteredStatuses)
  );
};
