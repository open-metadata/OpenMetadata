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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Type } from '../../generated/api/rdf/sparqlResponse';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  getGlossaryTermRelationSettings,
  getGlossaryTerms,
} from '../../rest/glossaryAPI';
import { runSparqlQuery } from '../../rest/rdfAPI';
import OntologyVisualQueryBuilder from './OntologyVisualQueryBuilder';

jest.mock('../../rest/glossaryAPI', () => ({
  getGlossaryTermRelationSettings: jest.fn(),
  getGlossaryTerms: jest.fn(),
}));

jest.mock('../../rest/rdfAPI', () => ({
  runSparqlQuery: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetRelationSettings =
  getGlossaryTermRelationSettings as jest.MockedFunction<
    typeof getGlossaryTermRelationSettings
  >;
const mockGetGlossaryTerms = getGlossaryTerms as jest.MockedFunction<
  typeof getGlossaryTerms
>;
const mockRunSparqlQuery = runSparqlQuery as jest.MockedFunction<
  typeof runSparqlQuery
>;

const antiMoneyLaunderingTerm: GlossaryTerm = {
  id: 'aml-id',
  name: 'AntiMoneyLaundering',
  displayName: 'Anti-Money Laundering',
  description: '',
  fullyQualifiedName: 'FinancialRiskCompliance.Compliance.AntiMoneyLaundering',
  glossary: { id: 'glossary-id', type: 'glossary' },
};
const knowYourCustomerTerm: GlossaryTerm = {
  id: 'kyc-id',
  name: 'KnowYourCustomer',
  displayName: 'Know Your Customer',
  description: '',
  fullyQualifiedName: 'FinancialRiskCompliance.Compliance.KnowYourCustomer',
  glossary: { id: 'glossary-id', type: 'glossary' },
};

describe('OntologyVisualQueryBuilder component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRelationSettings.mockResolvedValue({
      relationTypes: [
        {
          name: 'relatedTo',
          displayName: 'Related To',
          category: 'associative',
          rdfPredicate: 'https://open-metadata.org/ontology/relatedTo',
        },
        {
          name: 'partOf',
          displayName: 'Part Of',
          category: 'associative',
          rdfPredicate: 'https://open-metadata.org/ontology/partOf',
        },
      ],
    });
    mockGetGlossaryTerms.mockResolvedValue({
      data: [antiMoneyLaunderingTerm, knowYourCustomerTerm],
      paging: { total: 2 },
    });
    mockRunSparqlQuery.mockResolvedValue({
      format: 'json',
      body: '',
      contentType: 'application/sparql-results+json',
      durationMs: 12,
      parsed: {
        head: { vars: ['concept'] },
        results: {
          bindings: [
            {
              concept: {
                type: Type.URI,
                value: 'https://open-metadata.org/entity/glossaryTerm/result',
              },
            },
          ],
        },
      },
    });
  });

  it('allows the relationship and target term to be selected', async () => {
    render(<OntologyVisualQueryBuilder />);

    await waitFor(() =>
      expect(screen.getByText('Anti-Money Laundering')).toBeVisible()
    );

    expect(screen.getByTestId('ontology-generated-sparql')).toHaveTextContent(
      'FinancialRiskCompliance.Compliance.AntiMoneyLaundering'
    );

    fireEvent.click(
      screen.getByRole('button', { name: /label\.relationship-type/ })
    );
    fireEvent.click(await screen.findByRole('option', { name: 'Part Of' }));

    const targetSelector = screen.getByRole('combobox', {
      name: 'label.target-term',
    });

    expect(targetSelector).toHaveValue('Anti-Money Laundering');

    fireEvent.click(screen.getByRole('button', { name: 'Show options' }));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Know Your Customer' })
    );

    expect(screen.getByTestId('ontology-generated-sparql')).toHaveTextContent(
      '<https://open-metadata.org/ontology/partOf>'
    );
    expect(screen.getByTestId('ontology-generated-sparql')).toHaveTextContent(
      'FinancialRiskCompliance.Compliance.KnowYourCustomer'
    );

    fireEvent.click(screen.getByTestId('ontology-builder-run'));

    await waitFor(() =>
      expect(mockRunSparqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining(
            'FinancialRiskCompliance.Compliance.KnowYourCustomer'
          ),
        })
      )
    );

    expect(await screen.findByTestId('ontology-builder-result')).toBeVisible();
  });

  it('derives the initial selection from the loaded ontology graph', async () => {
    render(
      <OntologyVisualQueryBuilder
        graphData={{
          nodes: [
            {
              id: 'aml-id',
              label: 'Anti-Money Laundering',
              type: 'glossaryTerm',
              fullyQualifiedName:
                'FinancialRiskCompliance.Compliance.AntiMoneyLaundering',
            },
            {
              id: 'kyc-id',
              label: 'Know Your Customer',
              type: 'glossaryTerm',
              fullyQualifiedName:
                'FinancialRiskCompliance.Compliance.KnowYourCustomer',
            },
          ],
          edges: [
            {
              from: 'aml-id',
              to: 'kyc-id',
              label: 'Part Of',
              relationType: 'partOf',
            },
          ],
        }}
        relationTypes={[
          {
            name: 'relatedTo',
            displayName: 'Related To',
            category: 'associative',
            rdfPredicate: 'https://open-metadata.org/ontology/relatedTo',
          },
          {
            name: 'partOf',
            displayName: 'Part Of',
            category: 'associative',
            rdfPredicate: 'https://open-metadata.org/ontology/partOf',
          },
        ]}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /label\.relationship-type/ })
      ).toHaveTextContent('Part Of')
    );

    expect(screen.getByText('Know Your Customer')).toBeVisible();
    expect(mockGetRelationSettings).not.toHaveBeenCalled();
    expect(mockGetGlossaryTerms).not.toHaveBeenCalled();
  });
});
