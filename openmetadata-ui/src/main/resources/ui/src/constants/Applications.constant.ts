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

import { StepperStepType } from 'Models';
import i18n from '../utils/i18next/LocalUtil';

export const STEPS_FOR_APP_INSTALL: Array<StepperStepType> = [
  {
    name: i18n.t('label.detail-plural'),
    step: 1,
  },
  { name: i18n.t('label.configure'), step: 2 },
  { name: i18n.t('label.schedule'), step: 3 },
];

export const AUTO_PILOT_APP_NAME = 'AutoPilotApplication';
