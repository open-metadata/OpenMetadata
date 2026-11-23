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
import { act, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { OntologyExplorerProps } from '../../../../components/OntologyExplorer/OntologyExplorer.interface';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import OntologyExplorerPage from './OntologyExplorerPage';

let explorerProps: OntologyExplorerProps | undefined;

jest.mock('../../../../components/OntologyExplorer/OntologyExplorer', () => ({
  __esModule: true,
  default: (props: OntologyExplorerProps) => {
    explorerProps = props;

    return <div data-testid="ontology-explorer" />;
  },
}));

jest.mock('../../../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../../../hooks/useAppMode', () => ({
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <OntologyExplorerPage />
    </MemoryRouter>
  );

describe('OntologyExplorerPage', () => {
  beforeEach(() => {
    explorerProps = undefined;
  });

  it('shows the read-only explorer over every glossary', () => {
    renderPage();

    expect(screen.getByTestId('ontology-explorer')).toBeInTheDocument();
    expect(explorerProps?.scope).toBe('global');
    expect(screen.getByTestId('beta-badge')).toHaveTextContent('LABEL.BETA');
  });

  it('shows skeletons until the graph reports its stats, then each count with its label', () => {
    renderPage();
    const stats = screen.getByTestId('ontology-explorer-stats');

    expect(stats).not.toHaveTextContent(/\d/);

    act(() => {
      explorerProps?.onStatsChange?.(['151 Terms', '34 Relations', '7']);
      explorerProps?.onLoadingChange?.(false);
    });

    expect(within(stats).getByText('151')).toBeInTheDocument();
    expect(
      within(stats).getByText('Terms', { exact: false })
    ).toBeInTheDocument();
    expect(within(stats).getByText('34')).toBeInTheDocument();
    expect(within(stats).getByText('7')).toBeInTheDocument();
  });

  it('fills the page height in AI mode', () => {
    (useIsAiMode as jest.Mock).mockReturnValueOnce(true);
    renderPage();

    expect(explorerProps?.height).toBe('100%');
  });
});
