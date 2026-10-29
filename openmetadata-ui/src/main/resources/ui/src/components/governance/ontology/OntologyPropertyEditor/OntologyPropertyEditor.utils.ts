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
import { pick } from 'lodash';
import type { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../../constants/regex.constants';
import {
  Characteristic,
  CreateOntologyProperty,
  Kind,
} from '../../../../generated/api/data/createOntologyProperty';
import { OntologyProperty } from '../../../../generated/entity/data/ontologyProperty';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';

export interface OntologyPropertyFormValues {
  name: string;
  displayName: string;
  description: string;
  iri: string;
  kind: { id: Kind; label: string };
  domain: string;
  range: string;
  inverse: string;
  propertyChain: string;
  disjointWith: string;
  characteristics: { id: Characteristic; label: string }[];
  enumValues: { value: string; datatypeIri: string }[];
  unit: string;
  isIdentifier: boolean;
}

export const propertyFormValues = (
  property: Partial<OntologyProperty> = {}
): OntologyPropertyFormValues => {
  const {
    name = '',
    displayName = '',
    description = '',
    iri = '',
    kind = Kind.Object,
    domain = [],
    range = [],
    inverse = '',
    propertyChain = [],
    disjointWith = [],
    characteristics = [],
    enumValues = [],
    unit = '',
    isIdentifier = false,
  } = property;

  return {
    name,
    displayName,
    description,
    iri,
    kind: { id: kind, label: kind },
    domain: domain.join('\n'),
    range: range.join('\n'),
    inverse,
    propertyChain: propertyChain.join('\n'),
    disjointWith: disjointWith.join('\n'),
    characteristics: characteristics.map((id) => ({ id, label: id })),
    enumValues: enumValues.map((value) => ({
      ...value,
      datatypeIri: value.datatypeIri ?? '',
    })),
    unit,
    isIdentifier,
  };
};

const iriLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export const propertyRequest = (
  values: OntologyPropertyFormValues,
  ontology: string
): CreateOntologyProperty => ({
  name: values.name.trim(),
  displayName: values.displayName.trim() || undefined,
  description: values.description.trim() || undefined,
  iri: values.iri.trim() || undefined,
  kind: values.kind.id,
  ontology,
  domain: iriLines(values.domain),
  range: iriLines(values.range),
  ...(values.kind.id !== Kind.Annotation && {
    disjointWith: iriLines(values.disjointWith),
    characteristics: values.characteristics
      .map((item) => item.id)
      .filter(
        (value) =>
          values.kind.id === Kind.Object || value === Characteristic.Functional
      ),
  }),
  ...(values.kind.id === Kind.Object && {
    inverse: values.inverse.trim() || undefined,
    propertyChain: iriLines(values.propertyChain),
  }),
  ...(values.kind.id === Kind.Data && {
    enumValues: values.enumValues.map((value) => ({
      value: value.value,
      datatypeIri: value.datatypeIri.trim() || undefined,
    })),
    unit: values.unit.trim() || undefined,
    isIdentifier: values.isIdentifier,
  }),
});

export const propertyPatch = (
  property: OntologyProperty,
  request: CreateOntologyProperty
): Operation[] => {
  const fields = [
    'displayName',
    'description',
    'kind',
    'domain',
    'range',
    'inverse',
    'propertyChain',
    'disjointWith',
    'characteristics',
    'enumValues',
    'unit',
    'isIdentifier',
  ];
  const changes = compare(pick(property, fields), pick(request, fields));

  return property.version === undefined
    ? changes
    : [{ op: 'test', path: '/version', value: property.version }, ...changes];
};

export const propertyFormFields = (
  t: ReturnType<typeof useTranslation>['t'],
  kind: Kind,
  editing: boolean,
  disabled: boolean
): FieldProp[] => {
  const iriField = (
    name: string,
    label: string,
    multiple = false
  ): FieldProp => ({
    name,
    label,
    type: multiple ? FieldTypes.TEXTAREA : FieldTypes.TEXT,
    placeholder: multiple ? t('message.ontology-iri-per-line') : undefined,
    rules: {
      validate: (value: string) =>
        (multiple
          ? iriLines(value).every(isAbsoluteOntologyIri)
          : !value.trim() || isAbsoluteOntologyIri(value.trim())) ||
        t('message.invalid-concept-iri'),
    },
  });
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
      name: 'kind',
      label: t('label.type'),
      type: FieldTypes.SELECT,
      required: true,
      props: {
        isDisabled: editing,
        options: Object.values(Kind).map((id) => ({ id, label: id })),
      },
    },
    {
      ...iriField('iri', t('label.property-iri')),
      props: { isDisabled: editing },
    },
    iriField('domain', t('label.property-domain'), true),
    iriField('range', t('label.range'), true),
  ];
  if (kind !== Kind.Annotation) {
    fields.push(
      {
        name: 'characteristics',
        label: t('label.characteristic-plural'),
        type: FieldTypes.MULTI_SELECT,
        props: {
          items: (kind === Kind.Data
            ? [Characteristic.Functional]
            : Object.values(Characteristic)
          ).map((id) => ({ id, label: id })),
        },
      },
      iriField('disjointWith', t('label.disjoint-properties'), true)
    );
  }
  if (kind === Kind.Object) {
    fields.push(
      iriField('inverse', t('label.inverse')),
      iriField('propertyChain', t('label.property-chain'), true)
    );
  }
  if (kind === Kind.Data) {
    fields.push(
      { name: 'unit', label: t('label.unit'), type: FieldTypes.TEXT },
      {
        name: 'isIdentifier',
        label: t('label.identifier'),
        type: FieldTypes.CHECKBOX,
      }
    );
  }

  return fields.map((field) => ({
    ...field,
    props: { ...field.props, isDisabled: disabled || field.props?.isDisabled },
  }));
};
