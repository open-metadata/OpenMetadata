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
import i18n from '../utils/i18next/LocalUtil';

const EMAIL_CONFIG_FIELD_LABEL_KEYS: [string, string][] = [
  ['emailingEntity', 'label.emailing-entity'],
  ['enableSmtpServer', 'label.enable-smtp-server'],
  ['openMetadataUrl', 'label.brand-name-url'],
  ['password', 'label.password'],
  ['senderMail', 'label.sender-email'],
  ['serverEndpoint', 'label.server-endpoint'],
  ['serverPort', 'label.server-port'],
  ['supportUrl', 'label.support-url'],
  ['transportationStrategy', 'label.transportation-strategy'],
  ['username', 'label.username'],
];

export const getEmailConfigFieldLabels = (fieldName: string) => {
  const match = EMAIL_CONFIG_FIELD_LABEL_KEYS.find(
    ([field]) => field === fieldName
  );

  return match ? i18n.t(match[1]) : '';
};
