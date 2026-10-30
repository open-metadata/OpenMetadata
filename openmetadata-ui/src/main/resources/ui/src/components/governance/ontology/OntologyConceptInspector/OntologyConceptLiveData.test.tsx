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

import { act, fireEvent, screen } from '@testing-library/react';
import { OntologyConceptType } from '../../../../generated/entity/data/ontologyConcept';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { generateOntologyConceptQuery } from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import {
  getModelRelations,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import ontologyExplorerClassBase from '../../../../utils/OntologyExplorerClassBase';
import { OntologyConceptLiveDataExtensionProps } from '../../../../utils/OntologyExplorerClassBase.interface';
import OntologyConceptLiveData from './OntologyConceptLiveData';

jest.mock('../../../../rest/ontologyAPI');

const mockGenerate = generateOntologyConceptQuery as jest.MockedFunction<
  typeof generateOntologyConceptQuery
>;

const ontologyRef = { id: 'payments', type: 'ontology' };
const concept = (id: string, name: string) => ({
  id,
  name,
  displayName: name,
  fullyQualifiedName: `Payments.${id}`,
  iri: `urn:payments:${id}`,
  ontology: ontologyRef,
  conceptType: OntologyConceptType.OwlClass,
});
const transfer = concept('transfer', 'Funds Transfer');
const customer = concept('customer', 'Customer');
const model: OntologyStudioModel = {
  ontology: {
    id: 'payments',
    name: 'Payments',
    fullyQualifiedName: 'Payments',
    iri: 'urn:payments',
    namespace: 'urn:payments:',
  },
  concepts: [transfer, customer],
  properties: [
    {
      id: 'part-of',
      name: 'partOf',
      fullyQualifiedName: 'Payments.partOf',
      iri: 'urn:payments:partOf',
      kind: Kind.Object,
      ontology: ontologyRef,
      domain: [transfer.iri],
      range: [customer.iri],
    },
  ],
  axioms: [],
};
const relations = getModelRelations(model);
const ROOT_SQL =
  'SELECT transfer_id, amount_usd\nFROM payments.transfers\nLIMIT 50';
const HOP_SQL = [
  'SELECT t1.customer_id, t1.name',
  'FROM payments.transfers t0',
  'JOIN payments.customers t1 ON t0.customer_id = t1.customer_id -- part of',
  'LIMIT 50',
].join('\n');

const renderLiveData = () =>
  renderWithQueryClient(
    <OntologyConceptLiveData
      concept={transfer}
      model={model}
      relations={relations}
    />
  );

describe('OntologyConceptLiveData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerate.mockImplementation(async (_id, hops) => ({
      hops,
      sql: hops.length ? HOP_SQL : ROOT_SQL,
      dialect: undefined,
    }));
  });

  it('shows the generated SQL with the not stored badge and no preview in OSS', async () => {
    renderLiveData();

    expect(
      await screen.findByTestId('ontology-live-data-sql')
    ).toHaveTextContent(
      'SELECT transfer_id, amount_usd FROM payments.transfers LIMIT 50'
    );
    expect(
      screen.getByTestId('ontology-live-data-not-stored')
    ).toHaveTextContent('label.not-stored');
    expect(mockGenerate).toHaveBeenCalledWith(
      'transfer',
      [],
      expect.any(AbortSignal)
    );
    expect(screen.queryByTestId('live-data-extension')).not.toBeInTheDocument();
  });

  it('gets no live-data extension from the OSS class base', () => {
    expect(ontologyExplorerClassBase.getConceptLiveDataExtension()).toBeNull();
  });

  it('copies exactly the SQL it shows', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    renderLiveData();
    await screen.findByTestId('ontology-live-data-sql');

    await act(async () => {
      fireEvent.click(screen.getByTestId('ontology-live-data-copy'));
    });

    expect(writeText).toHaveBeenCalledWith(ROOT_SQL);
    expect(
      screen.getByTestId('ontology-live-data-copy-status')
    ).toHaveTextContent('label.copied');
  });

  it('adds a search-around hop, regenerates the SQL with it, and removes it again', async () => {
    renderLiveData();
    await screen.findByTestId('ontology-live-data-sql');

    fireEvent.click(screen.getByTestId('ontology-live-data-search-around'));
    fireEvent.click(
      screen.getByTestId(
        'ontology-live-data-hop-option-part-of:outgoing:customer'
      )
    );

    expect(await screen.findByText(/-- part of/)).toBeInTheDocument();
    expect(mockGenerate).toHaveBeenLastCalledWith(
      'transfer',
      [{ property: 'part-of', target: 'customer', direction: 'outgoing' }],
      expect.any(AbortSignal)
    );
    expect(screen.getByTestId('ontology-live-data-hops')).toHaveTextContent(
      'part of · Customer'
    );

    fireEvent.click(screen.getByTestId('ontology-live-data-search-around'));

    expect(
      screen.getByTestId(
        'ontology-live-data-hop-option-part-of:incoming:transfer'
      )
    ).toHaveTextContent('part of · Funds Transfer');

    fireEvent.click(screen.getByTestId('ontology-live-data-remove-hop'));

    expect(
      await screen.findByText(/FROM payments.transfers\s+LIMIT 50/)
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-live-data-hops')
    ).not.toBeInTheDocument();
  });

  it('labels an incoming relation with its declared inverse, and an outgoing one with itself', async () => {
    const inverseModel: OntologyStudioModel = {
      ...model,
      properties: [
        { ...model.properties[0], inverse: 'urn:payments:hasPart' },
        {
          id: 'has-part',
          name: 'hasPart',
          fullyQualifiedName: 'Payments.hasPart',
          iri: 'urn:payments:hasPart',
          kind: Kind.Object,
          ontology: ontologyRef,
          inverse: 'urn:payments:partOf',
        },
      ],
    };
    const inverseRelations = getModelRelations(inverseModel);
    const { unmount } = renderWithQueryClient(
      <OntologyConceptLiveData
        concept={transfer}
        model={inverseModel}
        relations={inverseRelations}
      />
    );

    fireEvent.click(screen.getByTestId('ontology-live-data-search-around'));

    expect(
      screen.getByTestId(
        'ontology-live-data-hop-option-part-of:outgoing:customer'
      )
    ).toHaveTextContent('part of · Customer');

    unmount();
    renderWithQueryClient(
      <OntologyConceptLiveData
        concept={customer}
        model={inverseModel}
        relations={inverseRelations}
      />
    );
    fireEvent.click(screen.getByTestId('ontology-live-data-search-around'));

    expect(
      screen.getByTestId(
        'ontology-live-data-hop-option-part-of:incoming:transfer'
      )
    ).toHaveTextContent('has part · Funds Transfer');
  });

  it('sends the direction of each chip it follows', async () => {
    renderWithQueryClient(
      <OntologyConceptLiveData
        concept={customer}
        model={model}
        relations={relations}
      />
    );
    await screen.findByTestId('ontology-live-data-sql');

    fireEvent.click(screen.getByTestId('ontology-live-data-search-around'));
    fireEvent.click(
      screen.getByTestId(
        'ontology-live-data-hop-option-part-of:incoming:transfer'
      )
    );
    fireEvent.click(screen.getByTestId('ontology-live-data-search-around'));
    fireEvent.click(
      screen.getByTestId(
        'ontology-live-data-hop-option-part-of:outgoing:customer'
      )
    );

    expect(mockGenerate).toHaveBeenLastCalledWith(
      'customer',
      [
        { property: 'part-of', target: 'transfer', direction: 'incoming' },
        { property: 'part-of', target: 'customer', direction: 'outgoing' },
      ],
      expect.any(AbortSignal)
    );
  });

  it('keeps an outgoing and an incoming chip with the same property and target', () => {
    const relatedModel: OntologyStudioModel = {
      ...model,
      properties: [
        {
          ...model.properties[0],
          id: 'related-to',
          name: 'relatedTo',
          fullyQualifiedName: 'Payments.relatedTo',
          iri: 'urn:payments:relatedTo',
          domain: [transfer.iri, customer.iri],
          range: [transfer.iri, customer.iri],
        },
      ],
    };
    renderWithQueryClient(
      <OntologyConceptLiveData
        concept={transfer}
        model={relatedModel}
        relations={getModelRelations(relatedModel)}
      />
    );

    fireEvent.click(screen.getByTestId('ontology-live-data-search-around'));

    expect(
      screen.getByTestId(
        'ontology-live-data-hop-option-related-to:outgoing:customer'
      )
    ).toHaveTextContent('related to · Customer');
    expect(
      screen.getByTestId(
        'ontology-live-data-hop-option-related-to:incoming:customer'
      )
    ).toHaveTextContent('related to · Customer');
  });

  it('stops offering search-around once the path has five hops', async () => {
    renderLiveData();
    await screen.findByTestId('ontology-live-data-sql');

    [
      'outgoing:customer',
      'incoming:transfer',
      'outgoing:customer',
      'incoming:transfer',
      'outgoing:customer',
    ].forEach((step) => {
      fireEvent.click(screen.getByTestId('ontology-live-data-search-around'));
      fireEvent.click(
        screen.getByTestId(`ontology-live-data-hop-option-part-of:${step}`)
      );
    });

    expect(screen.getByTestId('ontology-live-data-hops')).toHaveTextContent(
      'part of · Customer'
    );
    expect(
      screen.queryByTestId('ontology-live-data-search-around')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-live-data-remove-hop'));

    expect(
      screen.getByTestId('ontology-live-data-search-around')
    ).toBeInTheDocument();
  });

  it('says when the concept has no object-property relation to follow', async () => {
    renderWithQueryClient(
      <OntologyConceptLiveData
        concept={transfer}
        model={model}
        relations={[]}
      />
    );

    fireEvent.click(screen.getByTestId('ontology-live-data-search-around'));

    expect(
      screen.getByText('message.ontology-search-around-unavailable')
    ).toBeInTheDocument();
  });

  it('names the missing binding the server reports', async () => {
    mockGenerate.mockRejectedValue({
      response: {
        data: {
          message: 'Concept Funds Transfer has no bound table you can view',
        },
      },
    });
    renderLiveData();

    expect(
      await screen.findByText(
        'Concept Funds Transfer has no bound table you can view'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-live-data-sql')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-live-data-copy')).toBeDisabled();
  });

  it('renders the preview only when the class base returns an extension', async () => {
    const Extension = ({
      conceptId,
      query,
    }: OntologyConceptLiveDataExtensionProps) => (
      <button data-testid="live-data-extension" type="button">
        {conceptId}: {query.sql}
      </button>
    );
    const extension = jest
      .spyOn(ontologyExplorerClassBase, 'getConceptLiveDataExtension')
      .mockReturnValue(Extension);
    renderLiveData();

    expect(await screen.findByTestId('live-data-extension')).toHaveTextContent(
      'transfer: SELECT transfer_id, amount_usd FROM payments.transfers LIMIT 50'
    );

    extension.mockRestore();
  });
});
