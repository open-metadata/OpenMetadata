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
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  OntologyChangeOperation,
  OntologyChangeSet,
  OntologyChangeSetState,
  OperationState,
  OperationType,
  Provenance,
} from '../../generated/entity/data/ontologyChangeSet';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import OntologyAiProposalsPanel from './OntologyAiProposalsPanel';
import {
  AiProposalView,
  OntologyNode,
  OntologyProposalPermissions,
} from './OntologyExplorer.interface';
import { buildOntologyProposals } from './utils/ontologyProposals';

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
const RELATED_TO = { id: 'related-id', name: 'relatedTo', type: 'x' };
const RELATION_TYPES = [
  { displayName: 'Related to', id: 'related-id', name: 'relatedTo' },
  { displayName: 'See also', id: 'see-also-id', name: 'seeAlso' },
] as RelationshipType[];

const TERM_NAMES: Record<string, string> = {
  'account-id': 'Account',
  'ledger-id': 'Ledger',
  'op-revenue-term': 'Revenue',
};
const termRef = (id: string) => ({
  id,
  name: TERM_NAMES[id],
  type: 'glossaryTerm',
});

const relate = (
  id: string,
  fromId: string,
  toId: string
): OntologyChangeOperation =>
  ({
    id,
    operationType: OperationType.AddRelationship,
    relationship: {
      fromTerm: termRef(fromId),
      id: `${id}-rel`,
      provenance: Provenance.AISuggested,
      relationshipType: RELATED_TO,
      toTerm: termRef(toId),
    },
    state: OperationState.Active,
  } as OntologyChangeOperation);

const createTerm = (id: string, name: string): OntologyChangeOperation =>
  ({
    confidence: 0.88,
    id,
    operationType: OperationType.CreateTerm,
    sourceMemoryIds: ['memory-1'],
    state: OperationState.Active,
    term: {
      fullyQualifiedName: `Finance.${name}`,
      glossary: { id: 'finance-id', name: 'Finance', type: 'glossary' },
      id: `${id}-term`,
      name,
    },
  } as OntologyChangeOperation);

const draft = (
  id: string,
  operations: OntologyChangeOperation[]
): OntologyChangeSet =>
  ({
    description: 'AI draft',
    displayName: id,
    fullyQualifiedName: id,
    glossaries: [],
    id,
    name: id,
    operations,
    state: OntologyChangeSetState.Draft,
    undoCursor: operations.length,
  } as OntologyChangeSet);

const PROPOSALS = buildOntologyProposals(
  [
    draft('cs-revenue', [
      createTerm('op-revenue', 'Revenue'),
      relate('op-revenue-link', 'op-revenue-term', 'account-id'),
    ]),
    draft('cs-margin', [createTerm('op-margin', 'Margin')]),
    draft('cs-link', [relate('op-link', 'account-id', 'ledger-id')]),
  ],
  new Set(['finance-id']),
  [ACCOUNT, LEDGER]
);
const ALLOWED = { canApprove: true, canReject: true };

const renderPanel = (
  view: AiProposalView,
  permissions: OntologyProposalPermissions = ALLOWED
) => {
  const handlers = {
    onApplyAllRelationships: jest.fn(),
    onApplyAllTerms: jest.fn(),
    onApplyRelationship: jest.fn(),
    onApplyTerm: jest.fn(),
    onClose: jest.fn(),
    onRejectRelationship: jest.fn(),
    onRejectTerm: jest.fn(),
    onSelectTerm: jest.fn(),
    onViewChange: jest.fn(),
  };
  render(
    <OntologyAiProposalsPanel
      isSaving={false}
      permissions={permissions}
      proposals={PROPOSALS}
      relationTypes={RELATION_TYPES}
      view={view}
      {...handlers}
    />
  );

  return handlers;
};

describe('OntologyAiProposalsPanel', () => {
  describe('list', () => {
    it('lists proposed terms and adds them all from the footer', () => {
      const handlers = renderPanel({ kind: 'list', tab: 'terms' });

      expect(
        screen.getByTestId('ontology-ai-term-card-op-revenue')
      ).toHaveTextContent('Revenue');
      expect(
        screen.getByTestId('ontology-ai-term-card-op-margin')
      ).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('ontology-ai-proposals-apply-all'));

      expect(handlers.onApplyAllTerms).toHaveBeenCalledTimes(1);
      expect(handlers.onApplyAllRelationships).not.toHaveBeenCalled();
    });

    it('accepts every relationship from the relationships tab', () => {
      const handlers = renderPanel({ kind: 'list', tab: 'relationships' });

      expect(
        screen.getByTestId('ontology-ai-relationship-card-op-link')
      ).toHaveTextContent('Account');

      fireEvent.click(screen.getByTestId('ontology-ai-proposals-apply-all'));

      expect(handlers.onApplyAllRelationships).toHaveBeenCalledTimes(1);
    });

    it('switches tabs and opens a proposal from its card', () => {
      const handlers = renderPanel({ kind: 'list', tab: 'terms' });

      fireEvent.click(screen.getByRole('tab', { name: /label.relationship/ }));

      expect(handlers.onViewChange).toHaveBeenCalledWith({
        kind: 'list',
        tab: 'relationships',
      });

      fireEvent.click(screen.getByTestId('ontology-ai-term-card-op-margin'));

      expect(handlers.onViewChange).toHaveBeenLastCalledWith({
        key: 'op-margin',
        kind: 'item',
      });
    });

    it('does not let a user without approve permission add in bulk', () => {
      renderPanel(
        { kind: 'list', tab: 'terms' },
        { canApprove: false, canReject: true }
      );

      expect(
        screen.getByTestId('ontology-ai-proposals-apply-all')
      ).toBeDisabled();
    });
  });

  describe('term proposal', () => {
    const TERM_VIEW = { key: 'op-revenue', kind: 'item' } as const;

    it('adds the term with its checked relationships', () => {
      const handlers = renderPanel(TERM_VIEW);
      const add = screen.getByTestId('ontology-ai-proposal-add');

      expect(add).toHaveTextContent('label.add-term-with-link');

      fireEvent.click(add);

      expect(handlers.onApplyTerm).toHaveBeenCalledWith(
        PROPOSALS.terms[0],
        new Set(['op-revenue-link']),
        false
      );
    });

    it('leaves out an unchecked relationship and hands off to edit on "Add & edit"', () => {
      const handlers = renderPanel(TERM_VIEW);

      fireEvent.click(
        within(screen.getByTestId('ontology-ai-term-relationships')).getByRole(
          'checkbox'
        )
      );

      expect(screen.getByTestId('ontology-ai-proposal-add')).toHaveTextContent(
        'label.add-term'
      );

      fireEvent.click(screen.getByTestId('ontology-ai-proposal-add-and-edit'));

      expect(handlers.onApplyTerm).toHaveBeenCalledWith(
        PROPOSALS.terms[0],
        new Set(),
        true
      );
    });

    it('dismisses the term', () => {
      const handlers = renderPanel(TERM_VIEW);

      fireEvent.click(screen.getByTestId('ontology-ai-proposal-dismiss'));

      expect(handlers.onRejectTerm).toHaveBeenCalledWith(PROPOSALS.terms[0]);
    });

    it('disables each decision the user is not allowed to make', () => {
      renderPanel(TERM_VIEW, { canApprove: true, canReject: false });

      expect(screen.getByTestId('ontology-ai-proposal-dismiss')).toBeDisabled();
      expect(screen.getByTestId('ontology-ai-proposal-add')).toBeEnabled();
    });

    it('pages through the queue and returns to the list', () => {
      const handlers = renderPanel(TERM_VIEW);

      expect(
        screen.getByTestId('ontology-ai-proposal-previous')
      ).toBeDisabled();

      fireEvent.click(screen.getByTestId('ontology-ai-proposal-next'));

      expect(handlers.onViewChange).toHaveBeenLastCalledWith({
        key: 'op-margin',
        kind: 'item',
      });

      fireEvent.click(screen.getByTestId('ontology-ai-proposal-back'));

      expect(handlers.onViewChange).toHaveBeenLastCalledWith({
        kind: 'list',
        tab: 'terms',
      });
    });
  });

  describe('relationship proposal', () => {
    const RELATIONSHIP_VIEW = { key: 'op-link', kind: 'item' } as const;

    it('accepts the relationship with the proposed type', () => {
      const handlers = renderPanel(RELATIONSHIP_VIEW);

      expect(screen.getByTestId('ontology-ai-proposal-next')).toBeDisabled();

      fireEvent.click(screen.getByTestId('ontology-ai-proposal-accept'));

      expect(handlers.onApplyRelationship).toHaveBeenCalledWith(
        PROPOSALS.relationships[0],
        expect.objectContaining({ id: 'related-id', name: 'relatedTo' })
      );
    });

    it('accepts the relationship with a type the reviewer picked instead', () => {
      const handlers = renderPanel(RELATIONSHIP_VIEW);

      fireEvent.click(
        within(screen.getByTestId('ontology-ai-relationship-type')).getByRole(
          'button'
        )
      );
      fireEvent.click(screen.getByRole('option', { name: 'See also' }));
      fireEvent.click(screen.getByTestId('ontology-ai-proposal-accept'));

      expect(handlers.onApplyRelationship).toHaveBeenCalledWith(
        PROPOSALS.relationships[0],
        expect.objectContaining({ id: 'see-also-id', name: 'seeAlso' })
      );
    });

    it('opens an end term on the canvas', () => {
      const handlers = renderPanel(RELATIONSHIP_VIEW);

      fireEvent.click(
        within(screen.getByTestId('ontology-ai-relationship-ends')).getByText(
          'Ledger'
        )
      );

      expect(handlers.onSelectTerm).toHaveBeenCalledWith('ledger-id');
    });

    it('dismisses the relationship', () => {
      const handlers = renderPanel(RELATIONSHIP_VIEW);

      fireEvent.click(screen.getByTestId('ontology-ai-proposal-dismiss'));

      expect(handlers.onRejectRelationship).toHaveBeenCalledWith(
        PROPOSALS.relationships[0]
      );
    });
  });
});
