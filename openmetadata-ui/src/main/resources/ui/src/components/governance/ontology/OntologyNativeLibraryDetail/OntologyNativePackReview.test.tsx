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

import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  Kind,
  Status,
} from '../../../../generated/api/data/nativeOntologyImportSummary';
import { reviewNativeOntologyPack } from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyNativePackReview, {
  useNativePackReview,
} from './OntologyNativePackReview';

jest.mock('../../../../rest/ontologyAPI', () => ({
  reviewNativeOntologyPack: jest.fn(),
}));

const Harness = () => (
  <OntologyNativePackReview
    review={useNativePackReview('sales-id', 'fhir', ['core'])}
  />
);
const renderReview = () => renderWithQueryClient(<Harness />);

describe('OntologyNativePackReview', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists each definition the pack adds with the clash reason on its rule', async () => {
    (reviewNativeOntologyPack as jest.Mock).mockResolvedValue({
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
    });

    renderReview();

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
      items: [],
    });

    const { container } = renderReview();

    await waitFor(() => expect(reviewNativeOntologyPack).toHaveBeenCalled());

    expect(container).toBeEmptyDOMElement();
  });

  it('shows an error with a retry when the review fails, and lists the items once a retry succeeds', async () => {
    (reviewNativeOntologyPack as jest.Mock)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        items: [
          {
            id: 'concept:https://example.org/Patient',
            kind: Kind.Concept,
            label: 'Patient',
            status: Status.New,
            conceptIds: [],
          },
        ],
      });

    renderReview();

    expect(
      await screen.findByText('message.ontology-pack-review-failed')
    ).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-library-pack-review-retry'));

    expect(await screen.findByText('Patient')).toBeVisible();
    expect(
      screen.queryByText('message.ontology-pack-review-failed')
    ).not.toBeInTheDocument();
  });
});
