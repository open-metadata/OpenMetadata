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
import {
  FieldProp,
  FieldTypes,
  FormSelectItem,
} from '@openmetadata/ui-core-components';
import { compare, Operation } from 'fast-json-patch';
import { pick } from 'lodash';
import type { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../../constants/regex.constants';
import {
  ConceptMappingType,
  CreateOntologyConcept,
  OntologyConceptType,
} from '../../../../generated/api/data/createOntologyConcept';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';

export interface OntologyConceptFormValues {
  name: string;
  displayName: string;
  description: string;
  iri: string;
  conceptType: { id: OntologyConceptType; label: string };
  synonyms: FormSelectItem[];
  conceptMappings: {
    conceptIri: string;
    mappingType: { id: ConceptMappingType; label: string };
    schemeIri: string;
    source: string;
  }[];
}

export const conceptFormValues = (
  concept?: OntologyConcept
): OntologyConceptFormValues => ({
  name: concept?.name ?? '',
  displayName: concept?.displayName ?? '',
  description: concept?.description ?? '',
  iri: concept?.iri ?? '',
  conceptType: {
    id: concept?.conceptType ?? OntologyConceptType.OwlClass,
    label: concept?.conceptType ?? OntologyConceptType.OwlClass,
  },
  synonyms: (concept?.synonyms ?? []).map((value) => ({
    id: value,
    label: value,
  })),
  conceptMappings: (concept?.conceptMappings ?? []).map((mapping) => ({
    conceptIri: mapping.conceptIri,
    mappingType: { id: mapping.mappingType, label: mapping.mappingType },
    schemeIri: mapping.schemeIri ?? '',
    source: mapping.source ?? '',
  })),
});

export const conceptRequest = (
  values: OntologyConceptFormValues,
  ontology: string
): CreateOntologyConcept => ({
  name: values.name.trim(),
  displayName: values.displayName.trim() || undefined,
  description: values.description.trim() || undefined,
  iri: values.iri.trim() || undefined,
  conceptType: values.conceptType.id,
  synonyms: values.synonyms.map((value) => String(value.id)),
  conceptMappings: values.conceptMappings.map((mapping) => ({
    conceptIri: mapping.conceptIri.trim(),
    mappingType: mapping.mappingType.id,
    schemeIri: mapping.schemeIri.trim() || undefined,
    source: mapping.source.trim() || undefined,
  })),
  ontology,
});

export const conceptPatch = (
  concept: OntologyConcept,
  request: CreateOntologyConcept
): Operation[] => {
  const fields = [
    'displayName',
    'description',
    'conceptType',
    'synonyms',
    'conceptMappings',
  ];
  const changes = compare(pick(concept, fields), pick(request, fields));

  return concept.version === undefined
    ? changes
    : [{ op: 'test', path: '/version', value: concept.version }, ...changes];
};

export const mappingFormFields = (
  t: ReturnType<typeof useTranslation>['t'],
  index: number,
  disabled: boolean
): FieldProp[] => [
  {
    name: `conceptMappings.${index}.mappingType`,
    label: t('label.mapping-type'),
    type: FieldTypes.SELECT,
    required: true,
    props: {
      isDisabled: disabled,
      options: Object.values(ConceptMappingType).map((id) => ({
        id,
        label: id,
      })),
    },
  },
  {
    name: `conceptMappings.${index}.conceptIri`,
    label: t('label.concept-iri'),
    type: FieldTypes.TEXT,
    required: true,
    props: { isDisabled: disabled },
    rules: {
      validate: (value: string) =>
        isAbsoluteOntologyIri(value.trim()) || t('message.invalid-concept-iri'),
    },
  },
  {
    name: `conceptMappings.${index}.schemeIri`,
    label: t('label.scheme-iri'),
    type: FieldTypes.TEXT,
    props: { isDisabled: disabled },
    rules: {
      validate: (value: string) =>
        !value.trim() ||
        isAbsoluteOntologyIri(value.trim()) ||
        t('message.invalid-concept-iri'),
    },
  },
  {
    name: `conceptMappings.${index}.source`,
    label: t('label.source'),
    type: FieldTypes.TEXT,
    props: { isDisabled: disabled },
  },
];

export const conceptFormFields = (
  t: ReturnType<typeof useTranslation>['t'],
  editing: boolean,
  disabled: boolean
): FieldProp[] => {
  const fields: FieldProp[] = [
    {
      name: 'name',
      label: t('label.name'),
      type: FieldTypes.TEXT,
      required: true,
      props: { isDisabled: editing },
      rules: {
        validate: (value: string) =>
          Boolean(value.trim()) ||
          t('label.field-required', { field: t('label.name') }),
        pattern: {
          value: ENTITY_NAME_REGEX,
          message: t('message.entity-name-validation'),
        },
      },
    },
    {
      name: 'displayName',
      label: t('label.display-name'),
      type: FieldTypes.TEXT,
    },
    {
      name: 'description',
      label: t('label.description'),
      type: FieldTypes.TEXTAREA,
    },
    {
      name: 'conceptType',
      label: t('label.type'),
      type: FieldTypes.SELECT,
      required: true,
      props: {
        options: Object.values(OntologyConceptType).map((id) => ({
          id,
          label: id,
        })),
      },
    },
    {
      name: 'iri',
      label: t('label.concept-iri'),
      type: FieldTypes.TEXT,
      props: { isDisabled: editing },
      rules: {
        validate: (value: string) =>
          !value.trim() ||
          isAbsoluteOntologyIri(value.trim()) ||
          t('message.invalid-concept-iri'),
      },
    },
    {
      name: 'synonyms',
      label: t('label.synonym-plural'),
      type: FieldTypes.MULTI_SELECT,
      placeholder: t('message.synonym-placeholder'),
      props: { allowsCreation: true, hideDropdown: true, items: [] },
    },
  ];

  return fields.map((field) => ({
    ...field,
    props: { ...field.props, isDisabled: disabled || field.props?.isDisabled },
  }));
};
