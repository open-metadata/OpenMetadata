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
import { VALIDATION_STEP } from './BulkImport.constant';

export const ENTITY_BULK_EDIT_STEPS = [
  {
    name: i18n.t('label.preview-and-edit'),
    step: VALIDATION_STEP.EDIT_VALIDATE,
  },
  {
    name: i18n.t('label.update'),
    step: VALIDATION_STEP.UPDATE,
  },
];
