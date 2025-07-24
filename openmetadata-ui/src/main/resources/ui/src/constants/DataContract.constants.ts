/*
 *  Copyright 2025 Collate.
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

export enum EDataContractTab {
  CONTRACT_DETAIL,
  SCHEMA,
  SEMANTICS,
  QUALITY,
}

export const CREATE_DATA_CONTRACT_TAB_ITEMS = [
  {
    label: i18n.t('label.contract-detail'),
    key: EDataContractTab.CONTRACT_DETAIL,
  },
  {
    label: i18n.t('label.schema'),
    key: EDataContractTab.SCHEMA,
  },
  {
    label: i18n.t('label.semantic-plural'),
    key: EDataContractTab.SEMANTICS,
  },
  {
    label: i18n.t('label.quality'),
    key: EDataContractTab.QUALITY,
  },
];
