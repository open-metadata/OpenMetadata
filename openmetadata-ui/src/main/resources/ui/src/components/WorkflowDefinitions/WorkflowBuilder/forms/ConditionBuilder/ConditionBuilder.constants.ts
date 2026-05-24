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

import { WorkflowTriggerFields } from '../../../../../generated/type/workflowTriggerFields';
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

const WORKFLOW_TRIGGER_FIELD_LABELS: Record<string, string> = {
  [WorkflowTriggerFields.Certification]: 'label.certification',
  [WorkflowTriggerFields.Children]: 'label.children',
  [WorkflowTriggerFields.DataProducts]: 'label.data-product-plural',
  [WorkflowTriggerFields.Deleted]: 'label.deleted',
  [WorkflowTriggerFields.Description]: 'label.description',
  [WorkflowTriggerFields.DisplayName]: 'label.display-name',
  [WorkflowTriggerFields.Domains]: 'label.domain-plural',
  [WorkflowTriggerFields.Experts]: 'label.expert-plural',
  [WorkflowTriggerFields.Extension]: 'label.extension',
  [WorkflowTriggerFields.Glossary]: 'label.glossary',
  [WorkflowTriggerFields.Name]: 'label.name',
  [WorkflowTriggerFields.Owners]: 'label.owner-plural',
  [WorkflowTriggerFields.Parent]: 'label.parent',
  [WorkflowTriggerFields.References]: 'label.reference-plural',
  [WorkflowTriggerFields.RelatedTerms]: 'label.related-term-plural',
  [WorkflowTriggerFields.Reviewers]: 'label.reviewer-plural',
  [WorkflowTriggerFields.Synonyms]: 'label.synonym-plural',
  [WorkflowTriggerFields.Tags]: 'label.tag-plural',
};

type FetchOptionsFn = (
  s: string
) => Promise<{ value: string; label: string }[]>;

/** Dropdown fields that use API to fetch options (only a subset of WorkflowTriggerFields). */
const DROPDOWN_FIELDS: Partial<Record<string, FetchOptionsFn>> = {
  [WorkflowTriggerFields.Certification]: fetchCertificationOptions,
  [WorkflowTriggerFields.DataProducts]: fetchDataProductOptions,
  [WorkflowTriggerFields.Domains]: fetchDomainOptions,
  [WorkflowTriggerFields.Experts]: fetchExpertOptions,
  [WorkflowTriggerFields.Glossary]: fetchGlossaryOptions,
  [WorkflowTriggerFields.Owners]: fetchOwnerOptions,
  [WorkflowTriggerFields.Reviewers]: fetchExpertOptions,
  [WorkflowTriggerFields.RelatedTerms]: fetchRelatedTermsOptions,
  [WorkflowTriggerFields.Synonyms]: fetchSynonymsOptions,
  [WorkflowTriggerFields.Tags]: fetchTagOptions,
};

const BOOLEAN_OPTIONS: ConditionFieldDefinition['values'] = [
  { value: 'true', label: 'label.true' },
  { value: 'false', label: 'label.false' },
];

export const CONDITION_BUILDER_WORKFLOW_TRIGGER_FIELDS: ConditionFieldDefinition[] =
  Object.values(WorkflowTriggerFields).map((fieldValue) => {
    const fetchOptions = DROPDOWN_FIELDS[fieldValue];
    const isDropdown = Boolean(fetchOptions);
    const isBoolean = fieldValue === WorkflowTriggerFields.Deleted;
    let valueType: ConditionFieldDefinition['valueType'] = 'text';
    if (isBoolean) {
      valueType = 'boolean';
    } else if (isDropdown) {
      valueType = 'dropdown';
    }

    const supportsSearch =
      !fetchOptions || fieldValue !== WorkflowTriggerFields.Certification;

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
