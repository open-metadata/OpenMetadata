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
import { isAxiosError } from 'axios';
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
    id: ontology?.layer ?? Layer.L3,
    label: ontology?.layer ?? Layer.L3,
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

const USER_NAMESPACE_SEGMENT = 'onto';
const PREFIX_LENGTH = 8;
const PREFIX_FALLBACK = 'onto';
const PREFIX_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

/** `Ümlauts` reads `umlauts`, not `mlauts`: accents are folded before the ASCII filter. */
const foldAccents = (value: string) =>
  value.normalize('NFKD').replaceAll(/\p{M}/gu, '');

/**
 * Letters and digits of the name, so `VF Guard 1` and `VF Guard 2` stay apart.
 * A prefix already in use gets a number appended until it is free.
 */
export const derivePrefix = (
  name: string,
  isTaken: (prefix: string) => boolean = () => false
): string => {
  const base =
    foldAccents(name)
      .toLowerCase()
      .replaceAll(/[^a-z0-9]/g, '')
      .slice(0, PREFIX_LENGTH) || PREFIX_FALLBACK;
  let candidate = base;
  for (let suffix = 2; isTaken(candidate); suffix++) {
    candidate = `${base}${suffix}`;
  }

  return candidate;
};

export const isValidPrefix = (prefix: string): boolean =>
  PREFIX_PATTERN.test(prefix);

// ADR:2026-10-30-studio-created-ontologies-take-onto-iris
export const ontologyIris = (baseUri: string, prefix: string) => {
  const iri = `${baseUri.replace(
    /\/+$/,
    ''
  )}/${USER_NAMESPACE_SEGMENT}/${prefix}`;

  return { iri, namespace: `${iri}#` };
};

export const ONTOLOGY_NAME_MAX_LENGTH = 256;

export type OntologyNameError =
  | { kind: 'forbidden-character' }
  | { kind: 'too-long'; length: number }
  | { kind: 'id-required' }
  | { kind: 'duplicate'; name: string };

/** Kebab-cased display name, the default for the immutable ontology ID. */
export const deriveOntologyId = (displayName: string): string =>
  foldAccents(displayName)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

// Mirrors the server's entity-name rule so the dialog can refuse before a round trip.
const hasForbiddenCharacter = (value: string) =>
  value.includes('::') ||
  [...value].some(
    (character) => character === '"' || character === '>' || character < ' '
  );

export const validateOntologyName = (
  displayName: string,
  id: string,
  existing: readonly Ontology[] | undefined
): OntologyNameError | undefined => {
  const trimmed = displayName.trim();
  if (hasForbiddenCharacter(trimmed) || hasForbiddenCharacter(id)) {
    return { kind: 'forbidden-character' };
  }
  if (trimmed && !id.trim()) {
    return { kind: 'id-required' };
  }
  const length = Math.max(trimmed.length, id.length);
  if (length > ONTOLOGY_NAME_MAX_LENGTH) {
    return { kind: 'too-long', length };
  }
  const wanted = [trimmed, id].filter(Boolean).map((v) => v.toLowerCase());
  const clash = existing?.some((ontology) =>
    [ontology.name, ontology.displayName].some(
      (taken) => taken && wanted.includes(taken.toLowerCase())
    )
  );

  return clash ? { kind: 'duplicate', name: trimmed || id } : undefined;
};

/** Words for the server refusals a user can cause, so no regular expression reaches the toast. */
export const ontologyCreateErrorKey = (
  error: unknown
): 'duplicate' | 'forbidden-character' | 'too-long' | undefined => {
  if (!isAxiosError(error)) {
    return undefined;
  }
  const message = String(error.response?.data?.message ?? '');
  if (error.response?.status === 409) {
    return 'duplicate';
  }
  if (message.includes('must match')) {
    return 'forbidden-character';
  }

  return message.includes('size must be between') ? 'too-long' : undefined;
};

export interface OntologyDraftInput {
  readonly displayName: string;
  readonly idOverride?: string;
  readonly iriOverride?: string;
  readonly namespaceOverride?: string;
  readonly baseUri: string;
  readonly ontologies: readonly Ontology[] | undefined;
}

/** The identifiers a create dialog shows, and whether they can be submitted as they stand. */
export const resolveOntologyDraft = ({
  displayName,
  idOverride,
  iriOverride,
  namespaceOverride,
  baseUri,
  ontologies,
}: OntologyDraftInput) => {
  const generated = (prefix: string) =>
    baseUri ? ontologyIris(baseUri, prefix) : { iri: '', namespace: '' };
  const prefix = derivePrefix(displayName, (candidate) =>
    Boolean(
      ontologies?.some(
        ({ namespace }) => namespace === generated(candidate).namespace
      )
    )
  );
  const id = idOverride ?? deriveOntologyId(displayName);
  const iri = iriOverride ?? generated(prefix).iri;
  const namespace = namespaceOverride ?? (iri ? `${iri}#` : '');
  const nameError = displayName.trim()
    ? validateOntologyName(displayName, id, ontologies)
    : undefined;
  const isIriInvalid = Boolean(iri) && !isAbsoluteOntologyIri(iri);
  const isNamespaceInvalid =
    Boolean(namespace) && !isAbsoluteOntologyIri(namespace);
  const isNamespaceTaken = Boolean(
    ontologies?.some((taken) => taken.namespace === namespace)
  );

  return {
    id,
    iri,
    namespace,
    nameError,
    isIriInvalid,
    isNamespaceInvalid,
    isNamespaceTaken,
    isSubmittable: [
      Boolean(displayName.trim()),
      Boolean(id),
      !nameError,
      Boolean(iri) && !isIriInvalid,
      Boolean(namespace) && !isNamespaceInvalid,
      !isNamespaceTaken,
      Boolean(ontologies),
    ].every(Boolean),
  };
};

export interface GeneratedOntologyIdentity {
  readonly name: string;
  readonly displayName: string;
  readonly iri: string;
  readonly namespace: string;
}

const IDENTITY_SUFFIX_LIMIT = 1000;

/**
 * The readable name and `https` IRI an installed or imported ontology gets,
 * made the way the create dialog makes them. A name already taken gets " (2)".
 * Undefined while no RDF base URI is known, so callers keep their fallback.
 */
export const generatedOntologyIdentity = (
  title: string,
  baseUri: string,
  ontologies: readonly Ontology[] | undefined
): GeneratedOntologyIdentity | undefined => {
  if (!baseUri || !ontologies) {
    return undefined;
  }
  const base = title.trim() || 'Ontology';
  for (let attempt = 1; attempt < IDENTITY_SUFFIX_LIMIT; attempt++) {
    const displayName = attempt === 1 ? base : `${base} (${attempt})`;
    const draft = resolveOntologyDraft({
      displayName,
      idOverride: deriveOntologyId(displayName) || 'ontology',
      baseUri,
      ontologies,
    });
    if (draft.isSubmittable) {
      return {
        name: draft.id,
        displayName,
        iri: draft.iri,
        namespace: draft.namespace,
      };
    }
  }

  return undefined;
};

interface NewOntologyDraft {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly iri: string;
  readonly namespace: string;
  readonly layer: Layer;
  readonly owners: EntityReferenceOption[];
  readonly reviewers: EntityReferenceOption[];
}

export const newOntologyRequest = ({
  id,
  displayName,
  layer,
  ...rest
}: NewOntologyDraft): CreateOntology =>
  ontologyRequest({
    ...ontologyFormValues(),
    ...rest,
    name: id,
    displayName,
    layer: { id: layer, label: layer },
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
      isDisabled:
        disabled ||
        (editing && ['name', 'iri', 'namespace'].includes(field.name)),
    },
    rules: {
      ...field.rules,
      ...(field.required
        ? { required: t('label.field-required', { field: field.label }) }
        : {}),
    },
  }));
};
