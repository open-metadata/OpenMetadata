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
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { TableTypePropertyValueType } from '../../common/CustomPropertyTable/CustomPropertyTable.interface';

export type ExtensionDataTypes =
  | string
  | string[]
  | EntityReference
  | EntityReference[]
  | { start: number; end: number }
  | Partial<TableTypePropertyValueType>;

export interface ExtensionDataProps {
  [key: string]: ExtensionDataTypes;
}

export type ModalWithCustomPropertyEditorProps = {
  entityType: EntityType;
  header: string;
  value?: string;
  onSave: (extension?: string) => Promise<void>;
  onCancel?: () => void;
  visible: boolean;
};
