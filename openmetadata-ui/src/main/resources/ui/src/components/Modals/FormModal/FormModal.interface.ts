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

import { FormErrorData } from 'Models';
import { Classification } from '../../../generated/entity/classification/classification';
import { Team } from '../../../generated/entity/teams/team';

export type FormData = Classification | Team;
export type FormModalProp = {
  onCancel: () => void;
  onChange?: (data: Classification | Team) => void;
  onSave: (data: Classification | Team) => void;
  form: React.ElementType;
  header: string;
  initialData: FormData;
  errorData?: FormErrorData;
  isSaveButtonDisabled?: boolean;
  visible: boolean;
  showHiddenFields?: boolean;
};
export type FormRef = {
  fetchMarkDownData: () => string;
};
