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
import i18n from 'utils/i18next/LocalUtil';

export const getEmailConfigFieldLabels = (fieldName: string) => {
  switch (fieldName) {
    case 'emailingEntity':
      return i18n.t('label.emailing-entity');
    case 'enableSmtpServer':
      return i18n.t('label.enable-smtp-server');
    case 'openMetadataUrl':
      return i18n.t('label.open-metadata-url');
    case 'password':
      return i18n.t('label.password');
    case 'senderMail':
      return i18n.t('label.sender-email');
    case 'serverEndpoint':
      return i18n.t('label.server-endpoint');
    case 'serverPort':
      return i18n.t('label.server-port');
    case 'supportUrl':
      return i18n.t('label.support-url');
    case 'transportationStrategy':
      return i18n.t('label.transportation-strategy');
    case 'username':
      return i18n.t('label.username');
    default:
      return '';
  }
};
