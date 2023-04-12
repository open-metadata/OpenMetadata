/*
 *  Copyright 2022 Collate.
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

import { LabelType, State, TagSource } from 'generated/type/tagLabel';
import { t } from 'i18next';

export const TAG_CONSTANT = {
  labelType: LabelType.Manual,
  source: TagSource.Classification,
  state: State.Confirmed,
  tagFQN: t('label.add'),
};

export enum TAG_START_WITH {
  PLUS = '+',
}
