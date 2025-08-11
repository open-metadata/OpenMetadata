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
import { Rule } from 'antd/lib/form';
import { Constraint } from '../../../generated/entity/data/table';

export type EntityName = { name: string; displayName?: string; id?: string };

export type EntityNameWithAdditionFields = EntityName & {
  constraint: Constraint;
};

export interface EntityNameModalProps<
  T extends { name: string; displayName?: string }
> {
  visible: boolean;
  allowRename?: boolean;
  onCancel: () => void;
  onSave: (obj: T) => void | Promise<void>;
  entity: T;
  title: string;
  nameValidationRules?: Rule[];
  displayNameValidationRules?: Rule[];
  additionalFields?: React.ReactNode;
}
