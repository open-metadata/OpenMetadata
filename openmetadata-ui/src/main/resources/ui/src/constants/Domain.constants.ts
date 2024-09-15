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

export const DOMAIN_TYPE_DATA = [
  {
    type: i18n.t('label.aggregate'),
    description: i18n.t('message.aggregate-domain-type-description'),
  },
  {
    type: i18n.t('label.consumer-aligned'),
    description: i18n.t('message.consumer-aligned-domain-type-description'),
  },
  {
    type: i18n.t('label.source-aligned'),
    description: i18n.t('message.source-aligned-domain-type-description'),
  },
];
