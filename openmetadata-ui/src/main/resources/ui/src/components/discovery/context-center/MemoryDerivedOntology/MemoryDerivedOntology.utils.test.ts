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
import {
  OntologyMemoryProposalStatus,
  Result,
} from '../../../../generated/api/data/ontologyMemoryProposalStatus';
import {
  ContextMemory,
  EntityStatus,
  ShareVisibility,
} from '../../../../generated/entity/context/contextMemory';
import {
  canProposeFromMemory,
  getLastOutcomeMessage,
  getProposalLabel,
} from './MemoryDerivedOntology.utils';

const t = ((key: string, options?: { message?: string }) =>
  options?.message ? `${key}:${options.message}` : key) as unknown as TFunction;

const idle: OntologyMemoryProposalStatus = {
  enabled: true,
  proposals: [],
  queued: false,
};

const memory = (visibility: ShareVisibility): ContextMemory =>
  ({
    id: 'memory-id',
    name: 'memory',
    entityStatus: EntityStatus.Approved,
    shareConfig: { visibility },
    derivedEntities: [],
  } as unknown as ContextMemory);

const viewer = { isOwner: false, canCreateDrafts: true, isViewOnly: true };

describe('canProposeFromMemory', () => {
  it('lets a draft author propose from a published memory', () => {
    expect(
      canProposeFromMemory(memory(ShareVisibility.Public), idle, viewer)
    ).toBe(true);
  });

  it('keeps restricted memories for their owner', () => {
    expect(
      canProposeFromMemory(memory(ShareVisibility.Private), idle, viewer)
    ).toBe(false);
    expect(
      canProposeFromMemory(memory(ShareVisibility.Private), idle, {
        ...viewer,
        isOwner: true,
        canCreateDrafts: false,
      })
    ).toBe(true);
  });

  it('waits for the status and for any open work to finish', () => {
    const published = memory(ShareVisibility.Entity);

    expect(canProposeFromMemory(published, undefined, viewer)).toBe(false);
    expect(
      canProposeFromMemory(published, { ...idle, enabled: false }, viewer)
    ).toBe(false);
    expect(
      canProposeFromMemory(published, { ...idle, queued: true }, viewer)
    ).toBe(false);
  });

  it('blocks proposals from non-Active memories', () => {
    for (const status of [
      MemoryStatus.Draft,
      MemoryStatus.Archived,
      MemoryStatus.Superseded,
      MemoryStatus.Invalidated,
    ]) {
      const retired = { ...memory(ShareVisibility.Public), status };

      expect(canProposeFromMemory(retired, idle, viewer)).toBe(false);
    }
  });

  it('allows proposals from legacy memories without a stored status', () => {
    const legacy = { ...memory(ShareVisibility.Public), status: undefined };

    expect(canProposeFromMemory(legacy, idle, viewer)).toBe(true);
  });
});

describe('getLastOutcomeMessage', () => {
  it('reports failures with their reason and empty runs plainly', () => {
    expect(
      getLastOutcomeMessage(
        { ...idle, lastJob: { result: Result.Failed, message: 'boom' } },
        t
      )
    ).toBe('message.memory-proposal-failed:boom');
    expect(
      getLastOutcomeMessage(
        { ...idle, lastJob: { result: Result.NoNewTerms } },
        t
      )
    ).toBe('message.memory-proposal-no-new-terms');
  });

  it('stays quiet once a newer proposal is queued or open', () => {
    expect(
      getLastOutcomeMessage(
        { ...idle, queued: true, lastJob: { result: Result.Failed } },
        t
      )
    ).toBeUndefined();
    expect(
      getLastOutcomeMessage(
        { ...idle, lastJob: { result: Result.Proposed } },
        t
      )
    ).toBeUndefined();
  });
});

describe('getProposalLabel', () => {
  it('prefers the proposed term names over the draft name', () => {
    const changeSet = {
      id: 'draft-id',
      name: 'memory-glossary-1',
      type: 'ontologyChangeSet',
    };

    expect(getProposalLabel({ changeSet, terms: ['Churn', 'ARR'] })).toBe(
      'Churn, ARR'
    );
    expect(getProposalLabel({ changeSet, terms: [] })).toBe(
      'memory-glossary-1'
    );
  });
});
