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
import { startCase } from 'lodash';
import i18n from '../utils/i18next/LocalUtil';

export enum VALIDATION_STEP {
  UPLOAD = 0,
  EDIT_VALIDATE = 1,
  UPDATE = 2,
}

export const ENTITY_IMPORT_STEPS = [
  {
    name: startCase(i18n.t('label.upload-csv-uppercase-file')),
    step: VALIDATION_STEP.UPLOAD,
  },
  {
    name: i18n.t('label.preview-and-edit'),
    step: VALIDATION_STEP.EDIT_VALIDATE,
  },
  {
    name: i18n.t('label.update'),
    step: VALIDATION_STEP.UPDATE,
  },
];
