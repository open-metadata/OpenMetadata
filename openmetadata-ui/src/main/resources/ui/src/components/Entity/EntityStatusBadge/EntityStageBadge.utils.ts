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
import { TFunction } from 'i18next';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { STAGE_ACTION } from './EntityStageBadge.constants';

/** The menu and dialog label for requesting a stage: its own verb, or "Move to <stage>". */
export const getStageActionLabel = (t: TFunction, stage: EntityStatus) => {
  const action = STAGE_ACTION[stage];

  return action ? t(action) : t('label.move-to-stage', { stage });
};
