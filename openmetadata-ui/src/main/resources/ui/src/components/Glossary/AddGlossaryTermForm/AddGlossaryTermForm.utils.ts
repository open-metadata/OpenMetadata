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
import { DefaultOptionType } from 'antd/lib/select';
import { isEmpty, isString } from 'lodash';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { BuildGlossaryTermSavePayloadParams } from './AddGlossaryTermForm.interface';

export const getRelatedTermFqnList = (
  relatedTerms: DefaultOptionType[]
): string[] =>
  relatedTerms.map((tag: DefaultOptionType) => tag.value as string);

// In edit mode the related-terms multiselect can carry a plain FQN string (a
// value the user hasn't touched), a freshly picked option (`term.data.id`), or
// an antd-normalised `{ value }` option — resolve each back to the term id.
export const resolveRelatedTerms = (
  editMode: boolean,
  relatedTerms: DefaultOptionType[],
  glossaryTerm: GlossaryTerm | undefined
) =>
  editMode
    ? relatedTerms.map((term: DefaultOptionType) => {
        if (isString(term)) {
          return glossaryTerm?.relatedTerms?.find(
            (r) => r.fullyQualifiedName === term
          )?.id;
        }
        if (term.data) {
          return term.data.id;
        }

        return glossaryTerm?.relatedTerms?.find(
          (r) => r.fullyQualifiedName === term.value
        )?.id;
      })
    : getRelatedTermFqnList(relatedTerms);

export const buildGlossaryTermSavePayload = ({
  formObj,
  editMode,
  ownersList,
  reviewersList,
  currentUserId,
  glossaryTerm,
  extension,
}: BuildGlossaryTermSavePayloadParams) => {
  const {
    name,
    displayName = '',
    description = '',
    synonyms = [],
    tags = [],
    mutuallyExclusive = false,
    references = [],
    relatedTerms = [],
    color,
    iconURL,
  } = formObj;

  const selectedOwners =
    ownersList.length > 0
      ? ownersList
      : [
          {
            id: currentUserId ?? '',
            type: 'user',
          },
        ];

  const style = {
    color,
    iconURL,
  };

  return {
    name: name.trim(),
    displayName: displayName?.trim(),
    description: description,
    reviewers: reviewersList,
    relatedTerms: resolveRelatedTerms(editMode, relatedTerms, glossaryTerm),
    references: references.length > 0 ? references : undefined,
    synonyms: synonyms,
    mutuallyExclusive,
    tags: tags,
    owners: selectedOwners,
    style: isEmpty(style) ? undefined : style,
    ...(!editMode && !isEmpty(extension) ? { extension } : {}),
  };
};

export const toEntityReferenceArray = (
  value: EntityReference | EntityReference[]
): EntityReference[] => (Array.isArray(value) ? value : [value]);

export const getInitialDescription = (
  editMode: boolean,
  glossaryTerm: GlossaryTerm | undefined
): string | undefined =>
  editMode && glossaryTerm ? glossaryTerm.description : '';

export const getGlossaryTermFqn = (
  glossaryTerm: GlossaryTerm | undefined
): string => glossaryTerm?.fullyQualifiedName ?? '';
