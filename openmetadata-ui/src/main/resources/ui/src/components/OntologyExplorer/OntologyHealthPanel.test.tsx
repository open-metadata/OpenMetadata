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

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { usePersistentStorage } from '../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useIsAiMode } from '../../hooks/useAppMode';
import { OntologyNode } from './OntologyExplorer.interface';
import OntologyHealthPanel from './OntologyHealthPanel';
import { OntologyHealthSummary } from './OntologyStudio.utils';

jest.mock('../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

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
    expect(screen.getByText('label.attention')).toBeInTheDocument();
    expect(screen.queryByText('Account')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-health-review'));

    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(
      screen.queryByText('message.all-ontology-terms-connected')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-connect-term-2'));

    expect(onConnect).toHaveBeenCalledWith(isolatedTerms[1]);
  });

  it('lists isolated terms without a Connect action when the viewer cannot edit', () => {
    render(<OntologyHealthPanel health={health} />);
    fireEvent.click(screen.getByTestId('ontology-health-review'));

    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.queryByTestId('ontology-connect-term-1')).toBeNull();
    expect(screen.queryByRole('button', { name: /label.connect/ })).toBeNull();
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

    expect(
      screen.getByTestId('ontology-health-all-connected')
    ).toHaveTextContent('message.all-ontology-terms-connected');
    expect(
      screen.queryByTestId('ontology-isolated-count')
    ).not.toBeInTheDocument();
    expect(screen.getByText('label.healthy')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-health-review')
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: 'label.expand' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('label.isolated-term-plural')).toBeNull();
  });

  it('minimises to a compact summary and restores the card', () => {
    render(<OntologyHealthPanel health={health} onConnect={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'label.minimize' }));

    const minimized = screen.getByTestId('ontology-health-panel');

    expect(minimized).toHaveTextContent('60%');
    expect(minimized).toHaveTextContent('2 label.isolated');

    fireEvent.click(screen.getByTestId('ontology-health-restore'));

    expect(screen.getByText('label.ontology-health')).toBeInTheDocument();
  });

  describe('in AI mode', () => {
    beforeEach(() => {
      (useIsAiMode as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
      (useIsAiMode as jest.Mock).mockReturnValue(false);
    });

    it('keeps the review, minimise and connect controls working', () => {
      const onConnect = jest.fn();
      render(<OntologyHealthPanel health={health} onConnect={onConnect} />);

      expect(screen.getByText('60%')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('ontology-health-review'));
      fireEvent.click(screen.getByTestId('ontology-connect-term-1'));

      expect(onConnect).toHaveBeenCalledWith(isolatedTerms[0]);

      fireEvent.click(screen.getByRole('button', { name: 'label.minimize' }));
      fireEvent.click(screen.getByTestId('ontology-health-restore'));

      expect(screen.getByTestId('ontology-isolated-count')).toHaveTextContent(
        '2'
      );
    });
  });

  describe('minimized choice per user', () => {
    const signIn = (name: string) =>
      useApplicationStore.setState({
        currentUser: { id: name, name } as never,
      });

    afterEach(() => {
      usePersistentStorage.setState({ preferences: {} });
      useApplicationStore.setState({ currentUser: undefined });
    });

    it('opens minimized again for the user who minimized the sidebar card, and open for another user', () => {
      signIn('steward');
      render(<OntologyHealthPanel health={health} placement="sidebar" />);
      fireEvent.click(screen.getByRole('button', { name: 'label.minimize' }));

      expect(screen.getByTestId('ontology-health-restore')).toBeVisible();

      cleanup();
      render(<OntologyHealthPanel health={health} placement="sidebar" />);

      expect(screen.getByTestId('ontology-health-restore')).toBeVisible();

      cleanup();
      signIn('other');
      render(<OntologyHealthPanel health={health} placement="sidebar" />);

      expect(
        screen.queryByTestId('ontology-health-restore')
      ).not.toBeInTheDocument();
      expect(screen.getByText('label.ontology-health')).toBeVisible();
    });

    it('opens the card again once the user expands it', () => {
      signIn('steward');
      usePersistentStorage.setState({
        preferences: {
          steward: { isOntologyHealthMinimized: true } as never,
        },
      });
      render(<OntologyHealthPanel health={health} placement="sidebar" />);
      fireEvent.click(screen.getByTestId('ontology-health-restore'));
      cleanup();
      render(<OntologyHealthPanel health={health} placement="sidebar" />);

      expect(screen.getByText('label.ontology-health')).toBeVisible();
    });
  });
});
