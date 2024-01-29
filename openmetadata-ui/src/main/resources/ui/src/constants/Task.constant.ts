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

import i18n from '../utils/i18next/LocalUtil';

export const TASK_TYPES = {
  RequestTag: i18n.t('message.request-tags-message'),
  RequestDescription: i18n.t('message.request-description-message'),
  UpdateTag: i18n.t('message.update-tag-message'),
  UpdateDescription: i18n.t('message.update-description-message'),
  RequestTestCaseFailureResolution: i18n.t(
    'message.request-test-case-failure-resolution-message'
  ),
  RequestApproval: i18n.t('message.request-approval-message'),
  Generic: i18n.t('message.request-tags-message'),
};
