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
  OntologyChangeOperation,
  OntologyChangeSet,
  OntologyChangeSetState,
  OperationState,
  OperationType,
  Provenance,
} from '../../../generated/entity/data/ontologyChangeSet';
import { OntologyNode } from '../OntologyExplorer.interface';
import {
  buildOntologyProposals,
  getConfidenceColor,
  getProposalEdges,
  getRelationshipDecision,
  getTermDecision,
  withoutOperations,
} from './ontologyProposals';

const FINANCE = new Set(['finance-id']);
const ACCOUNT: OntologyNode = {
  fullyQualifiedName: 'Finance.Account',
  glossaryId: 'finance-id',
  id: 'account-id',
  label: 'Account',
  type: 'glossaryTerm',
};
const LEDGER: OntologyNode = {
  fullyQualifiedName: 'Finance.Ledger',
  glossaryId: 'finance-id',
  id: 'ledger-id',
  label: 'Ledger',
  type: 'glossaryTerm',
};

const createTerm = (
  id: string,
  name: string,
  overrides: Partial<OntologyChangeOperation> = {}
): OntologyChangeOperation =>
  ({
    confidence: 0.82,
    id,
    operationType: OperationType.CreateTerm,
    rationale: 'Named in three memories',
    sourceMemoryIds: ['memory-1'],
    state: OperationState.Active,
    term: {
      description: `${name} description`,
      fullyQualifiedName: `Finance.${name}`,
      glossary: { id: 'finance-id', name: 'Finance', type: 'glossary' },
      id: `${id}-term`,
      name,
    },
    ...overrides,
  } as OntologyChangeOperation);

const relate = (
  id: string,
  from: { id: string; fullyQualifiedName?: string },
  to: { id: string; fullyQualifiedName?: string },
  provenance = Provenance.AISuggested
): OntologyChangeOperation =>
  ({
    id,
    operationType: OperationType.AddRelationship,
    relationship: {
      fromTerm: { ...from, type: 'glossaryTerm' },
      id: `${id}-rel`,
      provenance,
      relationshipType: { id: 'related-id', name: 'relatedTo', type: 'x' },
      toTerm: { ...to, type: 'glossaryTerm' },
    },
    state: OperationState.Active,
  } as OntologyChangeOperation);

const draft = (
  id: string,
  operations: OntologyChangeOperation[],
  overrides: Partial<OntologyChangeSet> = {}
): OntologyChangeSet =>
  ({
    description: 'AI draft',
    displayName: 'AI draft',
    fullyQualifiedName: id,
    glossaries: [],
    id,
    name: id,
    operations,
    state: OntologyChangeSetState.Draft,
    undoCursor: operations.length,
    ...overrides,
  } as OntologyChangeSet);

describe('buildOntologyProposals', () => {
  it('turns an AI CREATE_TERM into a proposed node for a glossary on the canvas', () => {
    const { terms } = buildOntologyProposals(
      [draft('cs-1', [createTerm('op-1', 'Revenue')])],
      FINANCE,
      []
    );

    expect(terms.map((term) => term.node)).toEqual([
      {
        description: 'Revenue description',
        fullyQualifiedName: 'Finance.Revenue',
        glossaryId: 'finance-id',
        group: 'Finance',
        id: 'proposed-op-1',
        label: 'Revenue',
        proposal: { changeSetId: 'cs-1', operationId: 'op-1' },
        type: 'glossaryTerm',
      },
    ]);
  });

  it('skips manual, undone, out-of-scope, existing and repeated term proposals', () => {
    const { terms } = buildOntologyProposals(
      [
        draft(
          'cs-1',
          [
            createTerm('op-1', 'Revenue'),
            createTerm('op-2', 'Manual', { sourceMemoryIds: [] }),
            createTerm('op-3', 'Undone'),
          ],
          { undoCursor: 2 }
        ),
        draft('cs-2', [
          createTerm('op-4', 'Revenue'),
          createTerm('op-5', 'Account'),
        ]),
        draft('cs-3', [createTerm('op-6', 'Submitted')], {
          state: OntologyChangeSetState.Submitted,
        }),
      ],
      FINANCE,
      [ACCOUNT]
    );

    expect(terms.map((term) => term.key)).toEqual(['op-1']);
  });

  it('attaches a same-draft relationship to its proposed term and draws it', () => {
    const revenue = createTerm('op-1', 'Revenue');
    const proposals = buildOntologyProposals(
      [
        draft('cs-1', [
          revenue,
          relate(
            'op-2',
            { id: 'op-1-term' },
            { fullyQualifiedName: 'Finance.Account', id: 'unknown-id' }
          ),
        ]),
      ],
      FINANCE,
      [ACCOUNT]
    );

    expect(proposals.relationships).toEqual([]);
    expect(proposals.terms[0].relationships).toEqual([
      expect.objectContaining({
        fromId: 'proposed-op-1',
        key: 'op-2',
        toId: 'account-id',
      }),
    ]);
    expect(getProposalEdges(proposals)).toEqual([
      {
        from: 'proposed-op-1',
        label: 'relatedTo',
        proposal: { changeSetId: 'cs-1', operationId: 'op-2' },
        relationType: 'relatedTo',
        to: 'account-id',
      },
    ]);
  });

  it('lists an AI relationship between two drawn terms, but not a manual one', () => {
    const { relationships } = buildOntologyProposals(
      [
        draft('cs-1', [
          relate('op-1', { id: 'account-id' }, { id: 'ledger-id' }),
          relate(
            'op-2',
            { id: 'account-id' },
            { id: 'ledger-id' },
            Provenance.Manual
          ),
          relate('op-3', { id: 'account-id' }, { id: 'off-canvas-id' }),
        ]),
      ],
      FINANCE,
      [ACCOUNT, LEDGER]
    );

    expect(relationships.map((item) => item.key)).toEqual(['op-1']);
  });

  it('leaves out AI relationships between terms of a glossary not in scope', () => {
    const { relationships } = buildOntologyProposals(
      [
        draft('cs-1', [
          relate('op-1', { id: 'account-id' }, { id: 'ledger-id' }),
        ]),
      ],
      new Set(['other-id']),
      [ACCOUNT, LEDGER]
    );

    expect(relationships).toEqual([]);
  });
});

describe('proposal decisions', () => {
  const revenue = createTerm('op-1', 'Revenue');
  const linkA = relate('op-2', { id: 'op-1-term' }, { id: 'account-id' });
  const linkB = relate('op-3', { id: 'ledger-id' }, { id: 'op-1-term' });
  const [term] = buildOntologyProposals(
    [draft('cs-1', [revenue, linkA, linkB])],
    FINANCE,
    [ACCOUNT, LEDGER]
  ).terms;

  it('applies only checked relationships but retires all of the term', () => {
    expect(getTermDecision(term, new Set(['op-3']))).toEqual({
      apply: ['op-1', 'op-3'],
      changeSetId: 'cs-1',
      retire: ['op-1', 'op-2', 'op-3'],
    });
  });

  it('carries a changed relationship type as an edited operation', () => {
    const relationship = term.relationships[0];
    const seeAlso = { id: 'see-also-id', name: 'seeAlso', type: 'x' };

    expect(getRelationshipDecision(relationship).edited).toBeUndefined();
    expect(
      getRelationshipDecision(relationship, seeAlso).edited?.relationship
        ?.relationshipType
    ).toBe(seeAlso);
  });

  it('pulls the undo cursor back for every retired active operation', () => {
    const changeSet = draft('cs-1', [revenue, linkA, linkB], {
      undoCursor: 2,
    });

    expect(withoutOperations(changeSet, new Set(['op-1', 'op-3']))).toEqual({
      operations: [linkA],
      undoCursor: 1,
    });
  });
});

describe('getConfidenceColor', () => {
  it('reads high, medium and low confidence as success, warning and gray', () => {
    expect([88, 74, 58].map(getConfidenceColor)).toEqual([
      'success',
      'warning',
      'gray',
    ]);
  });
});
