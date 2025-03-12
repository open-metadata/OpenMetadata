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
import { Property } from '../pages/SearchSettingsPage/searchSettings.interface';
import i18n from '../utils/i18next/LocalUtil';

export const globalSettings: Property[] = [
  { key: 'maxAggregateSize', label: i18n.t('label.max-aggregate-size') },
  { key: 'maxResultHits', label: i18n.t('label.max-result-hits') },
  { key: 'maxAnalyzedOffset', label: i18n.t('label.max-analyzed-offset') },
];
