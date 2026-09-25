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
import { EntityType } from '../../../enums/entity.enum';
import { CreateGlossary } from '../../../generated/api/data/createGlossary';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  EntityReferenceOption,
  GlossaryFormValues,
} from './AddGlossary.interface';

export const GLOSSARY_FORM_DEFAULTS: GlossaryFormValues = {
  name: '',
  displayName: '',
  description: '',
  tags: [],
  mutuallyExclusive: false,
  owners: [],
  reviewers: [],
  domains: [],
};

export const toEntityReferenceOption = (
  reference: EntityReference
): EntityReferenceOption => ({
  id: reference.id,
  label: getEntityName(reference),
  supportingText: reference.fullyQualifiedName || reference.type,
  value: reference,
});

export const toEntityReferences = (
  options: EntityReferenceOption[] = []
): EntityReference[] => options.map((option) => option.value);

// The API requires an owner; the creator owns an entity nobody was assigned to.
export const getOwnersOrCurrentUser = (
  owners: EntityReference[],
  currentUserId?: string
): EntityReference[] =>
  owners.length > 0 ? owners : [{ id: currentUserId ?? '', type: 'user' }];

export const transformGlossaryFormData = (
  values: GlossaryFormValues,
  currentUserId?: string
): CreateGlossary => {
  const domains = toEntityReferences(values.domains)
    .map((domain) => domain.fullyQualifiedName)
    .filter((fqn): fqn is string => Boolean(fqn));

  return {
    name: values.name.trim(),
    displayName: values.displayName?.trim(),
    description: values.description,
    reviewers: toEntityReferences(values.reviewers),
    owners: getOwnersOrCurrentUser(
      toEntityReferences(values.owners),
      currentUserId
    ),
    tags: values.tags ?? [],
    mutuallyExclusive: Boolean(values.mutuallyExclusive),
    domains: domains.length > 0 ? domains : undefined,
  };
};

export const hasOwnerRuleViolation = (
  owners: EntityReferenceOption[] = [],
  { canAddMultipleUserOwners = true, canAddMultipleTeamOwner = true } = {}
): boolean => {
  const teamCount = owners.filter(
    (owner) => owner.value.type === EntityType.TEAM
  ).length;
  const userCount = owners.length - teamCount;

  if (!canAddMultipleUserOwners && userCount > 1) {
    return true;
  }

  // A team owner may not be combined with other owners under this rule.
  return !canAddMultipleTeamOwner && teamCount > 0 && owners.length > 1;
};
