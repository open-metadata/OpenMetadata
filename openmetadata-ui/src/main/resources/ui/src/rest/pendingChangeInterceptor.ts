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
import { AxiosInstance } from 'axios';
import { t } from '../utils/i18next/LocalUtil';
import { showInfoToast } from '../utils/ToastUtils';

// Axios exposes response header names lower-cased.
export const PENDING_CHANGE_HEADER = 'x-openmetadata-pending-change';
export const PENDING_CHANGE_EVENT = 'om:pending-change-submitted';

export interface PendingChangeEventDetail {
  changeRequestId: string;
}

/**
 * An edit to an approval-gated field is not published: the server answers with the unchanged
 * entity and names the change request it created. Tell the user, so an unchanged page does not
 * read as a failed save, and let pending-change indicators refresh.
 */
export const attachPendingChangeInterceptor = (client: AxiosInstance) => {
  client.interceptors.response.use((response) => {
    const changeRequestId = response.headers?.[PENDING_CHANGE_HEADER];
    if (changeRequestId) {
      showInfoToast(t('message.change-submitted-for-approval'));
      window.dispatchEvent(
        new CustomEvent<PendingChangeEventDetail>(PENDING_CHANGE_EVENT, {
          detail: { changeRequestId: String(changeRequestId) },
        })
      );
    }

    return response;
  });
};
