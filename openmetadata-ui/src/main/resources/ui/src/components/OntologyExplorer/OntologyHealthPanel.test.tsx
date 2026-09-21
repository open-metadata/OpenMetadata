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

import { fireEvent, render, screen } from '@testing-library/react';
import { OntologyNode } from './OntologyExplorer.interface';
import OntologyHealthPanel from './OntologyHealthPanel';
import { OntologyHealthSummary } from './OntologyStudio.utils';

const isolatedTerms: OntologyNode[] = [
  { id: 'term-1', label: 'Account', type: 'glossaryTerm' },
  { id: 'term-2', label: 'Customer', type: 'glossaryTerm' },
];

const health: OntologyHealthSummary = {
  connectedPercent: 60,
  connectedTermCount: 3,
  isolatedTerms,
  totalTermCount: 5,
};

describe('OntologyHealthPanel', () => {
  it('summarises isolation and lets the user connect each isolated term', () => {
    const onConnect = jest.fn();
    render(<OntologyHealthPanel health={health} onConnect={onConnect} />);

    expect(screen.getByTestId('ontology-isolated-count')).toHaveTextContent(
      '2'
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(
      screen.queryByText('message.all-ontology-terms-connected')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-connect-term-2'));

    expect(onConnect).toHaveBeenCalledWith(isolatedTerms[1]);
  });

  it('prefers the explicit isolated count over the list length', () => {
    render(
      <OntologyHealthPanel
        health={health}
        isolatedTermCount={7}
        onConnect={jest.fn()}
      />
    );

    expect(screen.getByTestId('ontology-isolated-count')).toHaveTextContent(
      '7'
    );
  });

  it('celebrates when no term is isolated', () => {
    render(
      <OntologyHealthPanel
        health={{
          connectedPercent: 100,
          connectedTermCount: 5,
          isolatedTerms: [],
          totalTermCount: 5,
        }}
        onConnect={jest.fn()}
      />
    );

    expect(screen.getByTestId('ontology-isolated-count')).toHaveTextContent(
      '0'
    );
    expect(
      screen.getByText('message.all-ontology-terms-connected')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
