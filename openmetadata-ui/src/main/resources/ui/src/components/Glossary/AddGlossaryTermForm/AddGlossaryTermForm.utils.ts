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
import { FormSelectItem } from '@openmetadata/ui-core-components';
import { TagSource } from '../../../generated/entity/data/container';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import {
  CustomProperty,
  EntityReference,
} from '../../../generated/entity/type';
import { serializeExtensionValue } from '../../../utils/CustomProperty.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { GlossaryPickerValue } from '../../common/GlossaryTermPicker/GlossaryTagSuggestionUtils';
import { getExtensionPropertyNameFromFormKey } from '../../Domain/AddDomainForm/AddDomainFormExtensionFields.utils';
import {
  getOwnersOrCurrentUser,
  toEntityReferenceOption,
  toEntityReferences,
} from '../AddGlossary/AddGlossary.utils';
import {
  GlossaryTermForm,
  GlossaryTermFormValues,
} from './AddGlossaryTermForm.interface';

export const GLOSSARY_TERM_FORM_DEFAULTS: GlossaryTermFormValues = {
  name: '',
  displayName: '',
  description: '',
  tags: [],
  synonyms: [],
  relatedTerms: [],
  references: [],
  iconURL: '',
  color: '',
  mutuallyExclusive: false,
  owners: [],
  reviewers: [],
  extensionFormValues: {},
};

export const getGlossaryTermFqn = (
  glossaryTerm: GlossaryTerm | undefined
): string => glossaryTerm?.fullyQualifiedName ?? '';

// Seeded from the reference; the id is resolved from `relatedTerms` on submit.
export const relatedTermToPickerValue = (
  related: EntityReference
): GlossaryPickerValue =>
  ({
    tagFQN: related.fullyQualifiedName ?? '',
    name: getEntityName(related),
    source: TagSource.Glossary,
  } as GlossaryPickerValue);

const toSynonymOptions = (synonyms: string[] = []): FormSelectItem[] =>
  synonyms.map((synonym) => ({ id: synonym, label: synonym }));

const toRelatedTermPickerValues = (
  relatedTerms: GlossaryTerm['relatedTerms'] = []
): GlossaryPickerValue[] =>
  relatedTerms.map((related) => relatedTermToPickerValue(related.term));

export const getGlossaryTermFormValues = (
  glossaryTerm?: GlossaryTerm
): GlossaryTermFormValues => {
  if (!glossaryTerm) {
    return GLOSSARY_TERM_FORM_DEFAULTS;
  }

  const {
    name,
    displayName = '',
    description = '',
    tags = [],
    references = [],
    style,
    owners = [],
    reviewers = [],
  } = glossaryTerm;

  return {
    ...GLOSSARY_TERM_FORM_DEFAULTS,
    name,
    displayName,
    description,
    tags,
    synonyms: toSynonymOptions(glossaryTerm.synonyms),
    relatedTerms: toRelatedTermPickerValues(glossaryTerm.relatedTerms),
    references,
    iconURL: style?.iconURL ?? '',
    color: style?.color ?? '',
    mutuallyExclusive: Boolean(glossaryTerm.mutuallyExclusive),
    owners: owners.map(toEntityReferenceOption),
    reviewers: reviewers.map(toEntityReferenceOption),
  };
};

// Create takes FQNs; edit takes ids, which a picked term carries as its entity.
export const resolveRelatedTerms = (
  editMode: boolean,
  relatedTerms: GlossaryPickerValue[],
  glossaryTerm: GlossaryTerm | undefined
): string[] =>
  editMode
    ? relatedTerms
        .map(
          (term) =>
            term.entity?.id ??
            glossaryTerm?.relatedTerms?.find(
              (related) => related.term.fullyQualifiedName === term.tagFQN
            )?.term.id
        )
        .filter((id): id is string => Boolean(id))
    : relatedTerms.map((term) => term.tagFQN);

export const buildGlossaryTermExtension = (
  extensionFormValues: Record<string, unknown> = {},
  customProperties: CustomProperty[]
): Record<string, unknown> =>
  Object.entries(extensionFormValues).reduce<Record<string, unknown>>(
    (extension, [formKey, rawValue]) => {
      const propertyName = getExtensionPropertyNameFromFormKey(formKey);
      const definition = customProperties.find(
        (property) => property.name === propertyName
      );
      const value = definition
        ? serializeExtensionValue(definition, rawValue)
        : rawValue;

      if (value !== undefined) {
        extension[propertyName] = value;
      }

      return extension;
    },
    {}
  );

interface BuildGlossaryTermSavePayloadParams {
  values: GlossaryTermFormValues;
  editMode: boolean;
  glossaryTerm?: GlossaryTerm;
  currentUserId?: string;
  customProperties?: CustomProperty[];
}

const buildStyle = ({
  color,
  iconURL,
}: GlossaryTermFormValues): GlossaryTermForm['style'] => {
  const style = {
    ...(color ? { color } : {}),
    ...(iconURL ? { iconURL } : {}),
  };

  return Object.keys(style).length > 0 ? style : undefined;
};

export const buildGlossaryTermSavePayload = ({
  values,
  editMode,
  glossaryTerm,
  currentUserId,
  customProperties = [],
}: BuildGlossaryTermSavePayloadParams): GlossaryTermForm => {
  const {
    name,
    displayName = '',
    description,
    references = [],
    relatedTerms = [],
    synonyms = [],
    tags = [],
  } = values;
  // Intake custom properties are only collected when a term is created.
  const extension = editMode
    ? {}
    : buildGlossaryTermExtension(values.extensionFormValues, customProperties);

  return {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    reviewers: toEntityReferences(values.reviewers),
    relatedTerms: resolveRelatedTerms(editMode, relatedTerms, glossaryTerm),
    references: references.length ? references : undefined,
    synonyms: synonyms.map((synonym) => String(synonym.id)),
    mutuallyExclusive: Boolean(values.mutuallyExclusive),
    tags,
    owners: getOwnersOrCurrentUser(
      toEntityReferences(values.owners),
      currentUserId
    ),
    style: buildStyle(values),
    ...(Object.keys(extension).length > 0 ? { extension } : {}),
  };
};
