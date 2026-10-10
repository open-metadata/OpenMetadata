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
import type { TFunction } from 'i18next';
import { DefaultColumnOrder } from '../../../../../../generated/api/configuration/appConfiguration';

// Same wording as the Sort menu on table pages, so users see one vocabulary.
export const COLUMN_ORDER_OPTIONS = [
  {
    value: DefaultColumnOrder.SourceOrder,
    getLabel: (t: TFunction) => t('label.original-order'),
    hintKey: 'message.original-order-description',
  },
  {
    value: DefaultColumnOrder.Alphabetical,
    getLabel: (t: TFunction) => `${t('label.alphabetical')} (A → Z)`,
    hintKey: 'message.alphabetical-order-description',
  },
];
