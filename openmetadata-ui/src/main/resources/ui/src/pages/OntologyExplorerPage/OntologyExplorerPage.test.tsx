/*
 *  Copyright 2024 Collate.
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
import { ReactNode } from 'react';
import OntologyExplorerPage from './OntologyExplorerPage';

interface ExplorerMockProps {
  isEditMode?: boolean;
  showHealth?: boolean;
  surface?: string;
}

interface PageLayoutMockProps {
  children?: ReactNode;
}

const mockOntologyExplorer = jest.fn<void, [ExplorerMockProps]>();

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: { displayName: 'Admin User', name: 'admin' },
  })),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: PageLayoutMockProps) => (
    <div data-testid="page-layout-v1">{children}</div>
  ),
}));

jest.mock('../../components/OntologyExplorer', () => ({
  OntologyExplorer: jest.fn((props: ExplorerMockProps) => {
    mockOntologyExplorer(props);

    return <div data-testid="ontology-explorer" />;
  }),
}));

jest.mock(
  '../../components/OntologyExplorer/OntologyStudioQueryConsole',
  () => ({
    __esModule: true,
    default: jest.fn(() => <div data-testid="sparql-query-console" />),
  })
);

jest.mock(
  '../../components/OntologyExplorer/OntologyVisualQueryBuilder',
  () => ({
    __esModule: true,
    default: jest.fn(() => <div data-testid="visual-query-builder" />),
  })
);

describe('OntologyExplorerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the dedicated Studio shell and graph by default', () => {
    render(<OntologyExplorerPage />);

    expect(screen.getByTestId('heading')).toHaveTextContent(
      'label.ontology-studio'
    );
    expect(screen.getByTestId('page-layout-v1')).toBeInTheDocument();
    expect(screen.getByTestId('ontology-studio-shell').className).not.toContain(
      'tw:fixed'
    );
    expect(screen.getByTestId('mode-tab-view')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('submode-tab-graph')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      screen.getByTestId('ontology-glossary-menu-trigger')
    ).toBeInTheDocument();
    expect(screen.getByTestId('ontology-explorer')).toBeInTheDocument();
    expect(
      screen.queryByTestId('sparql-query-console')
    ).not.toBeInTheDocument();
    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({ showHealth: true, surface: 'graph' })
    );
  });

  it('renders the SPARQL query console when Query mode is selected', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-query'));

    expect(screen.getByTestId('sparql-query-console')).toBeInTheDocument();
    expect(screen.queryByTestId('ontology-explorer')).not.toBeInTheDocument();
  });

  it('renders the graph with edit mode enabled when Edit is selected', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(screen.getByTestId('ontology-explorer')).toBeInTheDocument();
    expect(
      screen.queryByTestId('sparql-query-console')
    ).not.toBeInTheDocument();
    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({ isEditMode: true, surface: 'graph' })
    );
  });

  it('switches View to the glossary-grouped tree surface', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('submode-tab-tree'));

    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({ isEditMode: false, surface: 'tree' })
    );
  });

  it('switches Edit to the structured term surface', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-edit'));
    fireEvent.click(screen.getByTestId('submode-tab-term'));

    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({ isEditMode: true, surface: 'term' })
    );
  });

  it('switches Query to the visual builder surface', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-query'));
    fireEvent.click(screen.getByTestId('submode-tab-builder'));

    expect(screen.getByTestId('visual-query-builder')).toBeInTheDocument();
    expect(
      screen.queryByTestId('sparql-query-console')
    ).not.toBeInTheDocument();
  });

  it('returns to the graph when View mode is reselected', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-query'));
    fireEvent.click(screen.getByTestId('mode-tab-view'));

    expect(screen.getByTestId('ontology-explorer')).toBeInTheDocument();
    expect(
      screen.queryByTestId('sparql-query-console')
    ).not.toBeInTheDocument();
  });
});
