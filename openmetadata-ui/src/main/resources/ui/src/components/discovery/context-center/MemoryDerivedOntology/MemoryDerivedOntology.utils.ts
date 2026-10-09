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

import { TFunction } from 'i18next';
import { EntityType } from '../../../../enums/entity.enum';
import {
  OntologyMemoryProposalStatus,
  Proposal,
  Result,
} from '../../../../generated/api/data/ontologyMemoryProposalStatus';
import {
  ContextMemory,
  ContextMemoryStatus,
  EntityReference,
  ShareVisibility,
} from '../../../../generated/entity/context/contextMemory';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { ProposeAccess } from './MemoryDerivedOntology.types';

const PUBLISHED_VISIBILITIES = new Set<ShareVisibility>([
  ShareVisibility.Entity,
  ShareVisibility.Public,
]);

export const getDerivedTerms = (memory: ContextMemory): EntityReference[] =>
  memory.derivedEntities?.filter(
    (entity) => entity.type === EntityType.GLOSSARY_TERM
  ) ?? [];

export const isPublishedMemory = (memory: ContextMemory): boolean =>
  PUBLISHED_VISIBILITIES.has(
    memory.shareConfig?.visibility ?? ShareVisibility.Private
  );

const hasOpenWork = (status: OntologyMemoryProposalStatus): boolean =>
  status.queued || status.proposals.length > 0;

const isProposable = (memory: ContextMemory): boolean =>
  getDerivedTerms(memory).length === 0 &&
  (!memory.entityStatus ||
    memory.entityStatus === ContextMemoryStatus.Approved);

const isIdle = (status: OntologyMemoryProposalStatus | undefined): boolean =>
  status !== undefined && status.enabled && !hasOpenWork(status);

const hasProposeAccess = (
  memory: ContextMemory,
  { isOwner, canCreateDrafts }: ProposeAccess
): boolean => isOwner || (isPublishedMemory(memory) && canCreateDrafts);

export const canProposeFromMemory = (
  memory: ContextMemory,
  status: OntologyMemoryProposalStatus | undefined,
  access: ProposeAccess
): boolean =>
  access.isViewOnly &&
  isIdle(status) &&
  isProposable(memory) &&
  hasProposeAccess(memory, access);

export const getLastOutcomeMessage = (
  status: OntologyMemoryProposalStatus | undefined,
  t: TFunction
): string | undefined => {
  const outcome = status && !hasOpenWork(status) ? status.lastJob : undefined;
  if (outcome?.result === Result.Failed) {
    return t('message.memory-proposal-failed', {
      message: outcome.message ?? '',
    });
  }

  return outcome?.result === Result.NoNewTerms
    ? t('message.memory-proposal-no-new-terms')
    : undefined;
};

export const getProposalLabel = (proposal: Proposal): string =>
  proposal.terms.join(', ') || getEntityName(proposal.changeSet);
