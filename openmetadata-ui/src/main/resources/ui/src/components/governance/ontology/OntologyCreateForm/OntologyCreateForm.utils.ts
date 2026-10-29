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
import { FieldProp, FieldTypes } from '@openmetadata/ui-core-components';
import { compare, Operation } from 'fast-json-patch';
import { isUndefined, omitBy, pick } from 'lodash';
import type { useTranslation } from 'react-i18next';
import {
  CreateOntology,
  Layer,
} from '../../../../generated/api/data/createOntology';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';
import { EntityReferenceOption } from '../../../Glossary/AddGlossary/AddGlossary.interface';
import {
  getOwnersOrCurrentUser,
  toEntityReferenceOption,
  toEntityReferences,
} from '../../../Glossary/AddGlossary/AddGlossary.utils';
import { EntityReferencePicker } from '../../../Glossary/hooks/useEntityReferenceOptions';

export interface OntologyFormValues {
  name: string;
  displayName: string;
  description: string;
  iri: string;
  namespace: string;
  layer: { id: Layer; label: string };
  owners: EntityReferenceOption[];
  reviewers: EntityReferenceOption[];
}

export const ontologyFormValues = (
  ontology?: Ontology
): OntologyFormValues => ({
  name: ontology?.name ?? '',
  displayName: ontology?.displayName ?? '',
  description: ontology?.description ?? '',
  iri: ontology?.iri ?? '',
  namespace: ontology?.namespace ?? '',
  layer: {
    id: ontology?.layer ?? Layer.L1,
    label: ontology?.layer ?? Layer.L1,
  },
  owners: (ontology?.owners ?? []).map(toEntityReferenceOption),
  reviewers: (ontology?.reviewers ?? []).map(toEntityReferenceOption),
});

export const ontologyRequest = (
  values: OntologyFormValues,
  currentUserId?: string
): CreateOntology => ({
  name: values.name.trim(),
  displayName: values.displayName.trim() || undefined,
  description: values.description.trim() || undefined,
  iri: values.iri.trim(),
  namespace: values.namespace.trim(),
  layer: values.layer.id,
  owners: getOwnersOrCurrentUser(
    toEntityReferences(values.owners),
    currentUserId
  ),
  reviewers: toEntityReferences(values.reviewers),
});

export const ontologyPatch = (
  ontology: Ontology,
  values: OntologyFormValues
): Operation[] => {
  const fields = [
    'displayName',
    'description',
    'namespace',
    'layer',
    'owners',
    'reviewers',
  ];

  return [
    { op: 'test', path: '/version', value: ontology.version },
    ...compare(
      omitBy(
        pick(ontologyRequest(ontologyFormValues(ontology)), fields),
        isUndefined
      ),
      omitBy(pick(ontologyRequest(values), fields), isUndefined)
    ),
  ];
};

export const ontologyFormFields = (
  t: ReturnType<typeof useTranslation>['t'],
  owners: EntityReferencePicker,
  reviewers: EntityReferencePicker,
  disabled: boolean,
  editing = false
): FieldProp[] => {
  const iriRule = (value: string) =>
    !value.trim() ||
    isAbsoluteOntologyIri(value.trim()) ||
    t('message.invalid-concept-iri');
  const fields: FieldProp[] = [
    {
      name: 'name',
      label: t('label.name'),
      type: FieldTypes.TEXT,
      required: true,
      rules: {
        validate: (value: string) =>
          Boolean(value.trim()) ||
          t('label.field-required', { field: t('label.name') }),
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
      name: 'iri',
      label: t('label.ontology-iri'),
      type: FieldTypes.TEXT,
      required: true,
      rules: { validate: iriRule },
    },
    {
      name: 'namespace',
      label: t('label.namespace'),
      type: FieldTypes.TEXT,
      required: true,
      rules: { validate: iriRule },
    },
    {
      name: 'layer',
      label: t('label.layer'),
      type: FieldTypes.SELECT,
      required: true,
      props: { options: Object.values(Layer).map((id) => ({ id, label: id })) },
    },
    ...[
      { name: 'owners', label: t('label.owner-plural'), picker: owners },
      {
        name: 'reviewers',
        label: t('label.reviewer-plural'),
        picker: reviewers,
      },
    ].map(
      ({ name, label, picker }): FieldProp => ({
        name,
        label,
        type: FieldTypes.USER_TEAM_SELECT_INPUT,
        props: { multiple: true, filterOption: () => true, ...picker },
      })
    ),
  ];

  return fields.map((field) => ({
    ...field,
    props: {
      ...field.props,
      isDisabled: disabled || (editing && ['name', 'iri'].includes(field.name)),
    },
    rules: {
      ...field.rules,
      ...(field.required
        ? { required: t('label.field-required', { field: field.label }) }
        : {}),
    },
  }));
};
