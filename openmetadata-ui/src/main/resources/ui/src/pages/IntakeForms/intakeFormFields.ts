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

export interface IntakeFormNativeField {
  path: string;
  label: string;
}

/**
 * Curated list of native fields an admin may optionally mark required on an IntakeForm.
 * Schema-required fields (name, description, domains/domainType/glossary) are intentionally
 * excluded — they are enforced by the entity's JSON schema and cannot be overridden. System
 * fields (id, version, updatedAt, etc.) are likewise omitted.
 */
export const NATIVE_FIELDS_BY_ENTITY_TYPE: Record<
  TargetEntityType,
  IntakeFormNativeField[]
> = {
  [TargetEntityType.DataProduct]: [
    { path: 'displayName', label: 'Display Name' },
    { path: 'dataProductType', label: 'Type' },
    { path: 'visibility', label: 'Visibility' },
    { path: 'portfolioPriority', label: 'Portfolio Priority' },
    { path: 'tags', label: 'Tags' },
    { path: 'owners', label: 'Owners' },
    { path: 'reviewers', label: 'Reviewers' },
    { path: 'experts', label: 'Experts' },
  ],
  [TargetEntityType.Domain]: [
    { path: 'displayName', label: 'Display Name' },
    { path: 'tags', label: 'Tags' },
    { path: 'owners', label: 'Owners' },
    { path: 'experts', label: 'Experts' },
  ],
  [TargetEntityType.GlossaryTerm]: [
    { path: 'displayName', label: 'Display Name' },
    { path: 'synonyms', label: 'Synonyms' },
    { path: 'tags', label: 'Tags' },
    { path: 'reviewers', label: 'Reviewers' },
  ],
};

/**
 * Map each IntakeForm TargetEntityType enum value to the entity-type string used by the
 * /v1/metadata/types/name/{entityType}/customProperties API.
 */
export const ENTITY_TYPE_API_NAME: Record<TargetEntityType, string> = {
  [TargetEntityType.DataProduct]: 'dataProduct',
  [TargetEntityType.Domain]: 'domain',
  [TargetEntityType.GlossaryTerm]: 'glossaryTerm',
};
