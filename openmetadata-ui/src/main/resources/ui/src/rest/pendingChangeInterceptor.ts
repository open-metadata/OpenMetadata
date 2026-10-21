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
// A bulk asset write holds each gated asset in its own change request and reports how many.
export const PENDING_CHANGE_COUNT_HEADER =
  'x-openmetadata-pending-change-count';
export const PENDING_CHANGE_EVENT = 'om:pending-change-submitted';

export interface PendingChangeEventDetail {
  changeRequestId?: string;
  count?: number;
}

const notifySubmitted = (detail: PendingChangeEventDetail) =>
  window.dispatchEvent(
    new CustomEvent<PendingChangeEventDetail>(PENDING_CHANGE_EVENT, { detail })
  );

/**
 * An edit to an approval-gated field is not published: the server answers with the unchanged
 * entity and names the change request it created, or, for a bulk asset write, says how many
 * change requests it created. Tell the user, so an unchanged page does not read as a failed
 * save, and let pending-change indicators refresh.
 */
export const attachPendingChangeInterceptor = (client: AxiosInstance) => {
  client.interceptors.response.use((response) => {
    const changeRequestId = response.headers?.[PENDING_CHANGE_HEADER];
    const count = Number(response.headers?.[PENDING_CHANGE_COUNT_HEADER] ?? 0);
    if (changeRequestId) {
      showInfoToast(t('message.change-submitted-for-approval'));
      notifySubmitted({ changeRequestId: String(changeRequestId) });
    } else if (count > 0) {
      showInfoToast(
        count === 1
          ? t('message.change-submitted-for-approval')
          : t('message.change-plural-submitted-for-approval', { count })
      );
      notifySubmitted({ count });
    }

    return response;
  });
};
