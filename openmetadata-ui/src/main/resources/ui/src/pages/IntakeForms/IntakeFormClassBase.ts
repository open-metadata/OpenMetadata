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

import { TargetEntityType } from '../../generated/governance/intakeForm';
import {
  ENTITY_TYPE_API_NAME,
  IntakeFormNativeField,
  NATIVE_FIELDS_BY_ENTITY_TYPE,
} from './intakeFormFields';

/**
 * Extensibility seam for the IntakeForm designer. The Collate distribution
 * subclasses this to surface fork-specific native fields (e.g. the Data Product
 * banner upload) without having to fork the designer modal or the field map —
 * override {@link getNativeFields} there and re-export the singleton.
 */
class IntakeFormClassBase {
  /**
   * Curated native fields an admin may optionally mark required for the given
   * entity type. Returns a copy so callers can't mutate the shared catalog.
   */
  public getNativeFields(
    entityType: TargetEntityType
  ): IntakeFormNativeField[] {
    return [...(NATIVE_FIELDS_BY_ENTITY_TYPE[entityType] ?? [])];
  }

  /**
   * The entity-type string used by the
   * /v1/metadata/types/name/{entityType}/customProperties API.
   */
  public getEntityTypeApiName(entityType: TargetEntityType): string {
    return ENTITY_TYPE_API_NAME[entityType];
  }
}

const intakeFormClassBase = new IntakeFormClassBase();

export default intakeFormClassBase;
export { IntakeFormClassBase };
