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

import type { ConditionFieldDefinition } from './ConditionBuilder.interface';
import {
  fetchCertificationOptions,
  fetchDataProductOptions,
  fetchDomainOptions,
  fetchExpertOptions,
  fetchGlossaryOptions,
  fetchOwnerOptions,
  fetchRelatedTermsOptions,
  fetchSynonymsOptions,
  fetchTagOptions,
} from './conditionBuilderValueFetchers';

// Fields a JSON Logic value-condition can be written against — the entity-attribute surface (a
// curated subset of the common workflow trigger fields). Structural fields such as `columns` are
// intentionally absent: they resolve to arrays of objects and cannot be value-compared.
const WORKFLOW_TRIGGER_CONDITION_FIELDS: string[] = [
  'name',
  'displayName',
  'fullyQualifiedName',
  'description',
  'owners',
  'reviewers',
  'tags',
  'certification',
  'domains',
  'dataProducts',
  'extension',
  'deleted',
  'synonyms',
  'relatedTerms',
  'references',
  'glossary',
  'parent',
  'children',
  'experts',
  'style',
  'glossaryTerms',
];

const WORKFLOW_TRIGGER_FIELD_LABELS: Record<string, string> = {
  certification: 'label.certification',
  children: 'label.children',
  dataProducts: 'label.data-product-plural',
  deleted: 'label.deleted',
  description: 'label.description',
  displayName: 'label.display-name',
  domains: 'label.domain-plural',
  experts: 'label.expert-plural',
  extension: 'label.extension',
  glossary: 'label.glossary',
  name: 'label.name',
  owners: 'label.owner-plural',
  parent: 'label.parent',
  references: 'label.reference-plural',
  relatedTerms: 'label.related-term-plural',
  reviewers: 'label.reviewer-plural',
  synonyms: 'label.synonym-plural',
  tags: 'label.tag-plural',
};

type FetchOptionsFn = (
  s: string
) => Promise<{ value: string; label: string }[]>;

/** Dropdown fields that use API to fetch options (only a subset of trigger fields). */
const DROPDOWN_FIELDS: Partial<Record<string, FetchOptionsFn>> = {
  certification: fetchCertificationOptions,
  dataProducts: fetchDataProductOptions,
  domains: fetchDomainOptions,
  experts: fetchExpertOptions,
  glossary: fetchGlossaryOptions,
  owners: fetchOwnerOptions,
  reviewers: fetchExpertOptions,
  relatedTerms: fetchRelatedTermsOptions,
  synonyms: fetchSynonymsOptions,
  tags: fetchTagOptions,
};

const BOOLEAN_OPTIONS: ConditionFieldDefinition['values'] = [
  { value: 'true', label: 'label.true' },
  { value: 'false', label: 'label.false' },
];

export const CONDITION_BUILDER_WORKFLOW_TRIGGER_FIELDS: ConditionFieldDefinition[] =
  WORKFLOW_TRIGGER_CONDITION_FIELDS.map((fieldValue) => {
    const fetchOptions = DROPDOWN_FIELDS[fieldValue];
    const isDropdown = Boolean(fetchOptions);
    const isBoolean = fieldValue === 'deleted';
    let valueType: ConditionFieldDefinition['valueType'] = 'text';
    if (isBoolean) {
      valueType = 'boolean';
    } else if (isDropdown) {
      valueType = 'dropdown';
    }

    const supportsSearch = !fetchOptions || fieldValue !== 'certification';

    return {
      value: fieldValue,
      label: WORKFLOW_TRIGGER_FIELD_LABELS[fieldValue] ?? fieldValue,
      values: isBoolean ? BOOLEAN_OPTIONS : [],
      valueType,
      ...(fetchOptions && {
        fetchOptions,
        supportsSearch,
      }),
    };
  });
