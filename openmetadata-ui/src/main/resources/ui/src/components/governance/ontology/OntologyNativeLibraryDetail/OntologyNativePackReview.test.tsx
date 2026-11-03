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

import { screen, waitFor } from '@testing-library/react';
import {
  Kind,
  Status,
} from '../../../../generated/api/data/nativeOntologyImportSummary';
import { reviewNativeOntologyPack } from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyNativePackReview from './OntologyNativePackReview';

jest.mock('../../../../rest/ontologyAPI', () => ({
  reviewNativeOntologyPack: jest.fn(),
}));

describe('OntologyNativePackReview', () => {
  it('lists each definition the pack adds with the clash reason on its rule', async () => {
    (reviewNativeOntologyPack as jest.Mock).mockResolvedValue({
      changeSet: { operations: [] },
      summary: {
        items: [
          {
            id: 'concept:https://example.org/Patient',
            kind: Kind.Concept,
            label: 'Patient',
            status: Status.New,
            conceptIds: [],
          },
          {
            id: 'axiom:aaaaaaaaaaaaaaaa',
            kind: Kind.Rule,
            label: 'Patient and Person are disjoint',
            status: Status.New,
            warning: 'Patient and Person would clash with Employee',
            conceptIds: [],
          },
        ],
      },
    });

    renderWithQueryClient(
      <OntologyNativePackReview
        moduleIds={['core']}
        ontologyId="sales-id"
        packId="fhir"
      />
    );

    expect(await screen.findByText('Patient')).toBeVisible();
    expect(
      screen.getByTestId(
        'ontology-native-import-item-warning-axiom:aaaaaaaaaaaaaaaa'
      )
    ).toHaveTextContent('Patient and Person would clash with Employee');
    expect(reviewNativeOntologyPack).toHaveBeenCalledWith('sales-id', 'fhir', {
      moduleIds: ['core'],
    });
  });

  it('renders nothing when the pack adds no definitions', async () => {
    (reviewNativeOntologyPack as jest.Mock).mockResolvedValue({
      changeSet: { operations: [] },
      summary: { items: [] },
    });

    const { container } = renderWithQueryClient(
      <OntologyNativePackReview
        moduleIds={['core']}
        ontologyId="sales-id"
        packId="fhir"
      />
    );

    await waitFor(() => expect(reviewNativeOntologyPack).toHaveBeenCalled());

    expect(container).toBeEmptyDOMElement();
  });
});
