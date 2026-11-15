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
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { OntologyConceptDeleteImpact } from '../../../../generated/api/data/ontologyConceptDeleteImpact';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import {
  getOntologyConceptBindings,
  getOntologyConceptDeleteImpact,
  restoreOntologyDefinition,
  softDeleteOntologyDefinition,
} from '../../../../rest/ontologyAPI';
import { useEnUsTranslations } from '../../../../test/unit/enUsTranslation';
import { renderWithQueryClient as render } from '../../../../test/unit/test-utils';
import OntologyConceptDeleteDialog from './OntologyConceptDeleteDialog';

jest.mock('../../../../rest/ontologyAPI');

const concept = {
  id: 'customer',
  name: 'Customer',
  fullyQualifiedName: 'Retail.Customer',
} as OntologyConcept;
const reference = (id: string, name: string) => ({
  id,
  name,
  type: 'ontologyAxiom',
});
const impactOf = (
  overrides: Partial<OntologyConceptDeleteImpact> = {}
): OntologyConceptDeleteImpact => ({
  blockers: [],
  children: [],
  concept: { id: concept.id, name: 'Customer', type: 'ontologyConcept' },
  relationships: [],
  rules: [],
  ...overrides,
});
const bindingsOf = (names: string[]) => ({
  kind: 'complete' as const,
  revision: 1,
  assets: names.map((name) => ({
    assetId: name,
    assetType: 'table',
    asset: { id: name, name, type: 'table' },
    columns: [],
  })),
});

const renderDialog = () => {
  const onDeleted = jest.fn();
  const onCancel = jest.fn();
  render(
    <OntologyConceptDeleteDialog
      concept={concept}
      onCancel={onCancel}
      onDeleted={onDeleted}
    />
  );

  return { onCancel, onDeleted };
};

describe('OntologyConceptDeleteDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEnUsTranslations();
    (getOntologyConceptBindings as jest.Mock).mockResolvedValue(bindingsOf([]));
    (softDeleteOntologyDefinition as jest.Mock).mockResolvedValue(undefined);
    (restoreOntologyDefinition as jest.Mock).mockResolvedValue(undefined);
  });

  it('lists what the concept takes with it in plain sentences', async () => {
    (getOntologyConceptDeleteImpact as jest.Mock).mockResolvedValue(
      impactOf({
        children: [
          reference('c1', 'Retail Customer'),
          reference('c2', 'Wholesale Customer'),
        ],
        relationships: [reference('a1', 'CustomerIsParty')],
        rules: [reference('a2', 'a'), reference('a3', 'b')],
      })
    );
    (getOntologyConceptBindings as jest.Mock).mockResolvedValue(
      bindingsOf(['customers'])
    );
    renderDialog();

    expect(
      await screen.findByText('Deleting Customer also affects:')
    ).toBeInTheDocument();
    expect(screen.getByTestId('ontology-delete-children')).toHaveTextContent(
      '2 child concepts will move to the top level: Retail Customer, Wholesale Customer.'
    );
    expect(
      screen.getByTestId('ontology-delete-relationships')
    ).toHaveTextContent('1 relationship will be removed.');
    expect(screen.getByTestId('ontology-delete-rules')).toHaveTextContent(
      '2 rules will be removed.'
    );
    expect(screen.getByTestId('ontology-delete-bindings')).toHaveTextContent(
      '1 data asset binding will be removed (customers). The asset itself is not changed.'
    );
  });

  it('says nothing else refers to a concept with no impact', async () => {
    (getOntologyConceptDeleteImpact as jest.Mock).mockResolvedValue(impactOf());
    renderDialog();

    expect(
      await screen.findByText('Nothing else refers to Customer.')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-delete-remove-references')
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-concept-delete-confirm')
      ).toBeEnabled()
    );
  });

  it('removes the listed relationships and rules before the concept, then hands back an undo', async () => {
    (getOntologyConceptDeleteImpact as jest.Mock).mockResolvedValue(
      impactOf({
        relationships: [reference('a1', 'CustomerIsParty')],
        rules: [reference('a2', 'CustomerRule')],
      })
    );
    const { onDeleted } = renderDialog();
    await screen.findByTestId('ontology-delete-remove-references');
    await act(async () => {
      fireEvent.click(screen.getByTestId('ontology-concept-delete-confirm'));
    });

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));

    expect((softDeleteOntologyDefinition as jest.Mock).mock.calls).toEqual([
      ['axiom', 'a1'],
      ['axiom', 'a2'],
      ['concept', 'customer'],
    ]);

    await act(async () => {
      await onDeleted.mock.calls[0][0].restore();
    });

    expect((restoreOntologyDefinition as jest.Mock).mock.calls).toEqual([
      ['concept', 'customer'],
      ['axiom', 'a1'],
      ['axiom', 'a2'],
    ]);
  });

  it('keeps Delete disabled while the references are left in place', async () => {
    (getOntologyConceptDeleteImpact as jest.Mock).mockResolvedValue(
      impactOf({ relationships: [reference('a1', 'CustomerIsParty')] })
    );
    renderDialog();
    fireEvent.click(
      await screen.findByTestId('ontology-delete-remove-references')
    );

    expect(
      screen.getByTestId('ontology-concept-delete-confirm')
    ).toBeDisabled();
  });

  it('blocks Delete and names what still points at the concept', async () => {
    (getOntologyConceptDeleteImpact as jest.Mock).mockResolvedValue(
      impactOf({ blockers: [reference('p1', 'servedBy')] })
    );
    renderDialog();

    expect(
      await screen.findByTestId('ontology-delete-blockers')
    ).toHaveTextContent(
      'servedBy still point at Customer through a domain, range or replacement. Change them first, then delete Customer.'
    );
    expect(
      screen.getByTestId('ontology-concept-delete-confirm')
    ).toBeDisabled();
  });

  it('puts back what it removed and shows one sentence when the server refuses', async () => {
    (getOntologyConceptDeleteImpact as jest.Mock).mockResolvedValue(
      impactOf({ relationships: [reference('a1', 'CustomerIsParty')] })
    );
    (softDeleteOntologyDefinition as jest.Mock).mockImplementation(
      async (type: string) => {
        if (type === 'concept') {
          throw new Error('400');
        }
      }
    );
    const { onDeleted } = renderDialog();
    await screen.findByTestId('ontology-delete-remove-references');
    await act(async () => {
      fireEvent.click(screen.getByTestId('ontology-concept-delete-confirm'));
    });

    expect(
      await screen.findByTestId('ontology-delete-failed')
    ).toHaveTextContent(
      'Customer could not be deleted. Something still refers to it. Review what it touches and try again.'
    );
    expect(restoreOntologyDefinition).toHaveBeenCalledWith('axiom', 'a1');
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
