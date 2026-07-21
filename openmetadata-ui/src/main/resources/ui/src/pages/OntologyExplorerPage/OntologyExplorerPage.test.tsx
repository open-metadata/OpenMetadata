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
  isAuthoringMode?: boolean;
  isEditMode?: boolean;
  showHealth?: boolean;
  surface?: string;
}

interface AiAssistantMockProps {
  onOpenQuery: (query: string) => void;
}

interface QueryConsoleMockProps {
  initialQuery?: string;
}

interface PageLayoutMockProps {
  children?: ReactNode;
}

interface LibraryMockProps {
  onClose?: () => void;
}

const mockOntologyExplorer = jest.fn<void, [ExplorerMockProps]>();
const mockQueryConsole = jest.fn<void, [QueryConsoleMockProps]>();
const mockUseOntologyAiCapability = jest.fn(() => ({
  isEnabled: false,
  isLoading: false,
  isRdfEnabled: true,
}));
const mockUseOntologyEditLease = jest.fn(() => ({
  isOwned: true,
  lock: undefined,
  retry: jest.fn(),
  state: 'owned' as const,
}));
const mockUseAuth = jest.fn(() => ({
  isAdminUser: true,
  isFirstTimeUser: false,
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: { displayName: 'Admin User', name: 'admin' },
  })),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock(
  '../../components/OntologyExplorer/hooks/useOntologyAiCapability',
  () => ({
    useOntologyAiCapability: () => mockUseOntologyAiCapability(),
  })
);

jest.mock(
  '../../components/OntologyExplorer/hooks/useOntologyEditLease',
  () => ({
    useOntologyEditLease: () => mockUseOntologyEditLease(),
  })
);

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(() => ({ permissions: {} })),
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

jest.mock('../../components/OntologyExplorer/OntologyLibrary', () => ({
  __esModule: true,
  default: jest.fn(({ onClose }: LibraryMockProps) => (
    <div data-testid="ontology-library">
      <button type="button" onClick={onClose}>
        Close library
      </button>
    </div>
  )),
}));

jest.mock('../../components/OntologyExplorer/OntologyAiAssistant', () => ({
  __esModule: true,
  default: jest.fn(({ onOpenQuery }: AiAssistantMockProps) => (
    <div data-testid="ontology-ai-assistant">
      <button
        type="button"
        onClick={() => onOpenQuery('SELECT ?term WHERE {}')}>
        Open generated query
      </button>
    </div>
  )),
}));

jest.mock('../../components/OntologyExplorer/OntologyImportExportMenu', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="ontology-import-export" />),
}));

jest.mock(
  '../../components/OntologyExplorer/OntologyStudioQueryConsole',
  () => ({
    __esModule: true,
    default: jest.fn((props: QueryConsoleMockProps) => {
      mockQueryConsole(props);

      return <div data-testid="sparql-query-console" />;
    }),
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
    mockUseAuth.mockReturnValue({
      isAdminUser: true,
      isFirstTimeUser: false,
    });
    mockUseOntologyAiCapability.mockReturnValue({
      isEnabled: false,
      isLoading: false,
      isRdfEnabled: true,
    });
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

  it('explains that SPARQL is unavailable when the knowledge graph is disabled', () => {
    mockUseOntologyAiCapability.mockReturnValue({
      isEnabled: false,
      isLoading: false,
      isRdfEnabled: false,
    });

    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-query'));

    expect(
      screen.getByTestId('ontology-rdf-disabled-notice')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('sparql-query-console')
    ).not.toBeInTheDocument();
  });

  it('renders the graph with edit mode enabled when Edit is selected', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(screen.getByTestId('ontology-explorer')).toBeInTheDocument();
    expect(
      screen.queryByTestId('sparql-query-console')
    ).not.toBeInTheDocument();
    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isAuthoringMode: true,
        isEditMode: true,
        surface: 'graph',
      })
    );
  });

  it('switches View to the glossary-grouped tree surface', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('submode-tab-tree'));

    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({ isEditMode: false, surface: 'tree' })
    );
  });

  it('offers only the graph and model surfaces in Edit (no term or bulk)', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(screen.getByTestId('submode-tab-graph')).toBeInTheDocument();
    expect(screen.getByTestId('submode-tab-model')).toBeInTheDocument();
    expect(screen.queryByTestId('submode-tab-term')).not.toBeInTheDocument();
    expect(screen.queryByTestId('submode-tab-bulk')).not.toBeInTheDocument();
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

  it('opens the ontology library from the dedicated header action', () => {
    render(<OntologyExplorerPage />);

    expect(screen.queryByTestId('mode-tab-library')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-library-trigger'));

    expect(screen.getByTestId('ontology-library')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close library' }));

    expect(screen.queryByTestId('ontology-library')).not.toBeInTheDocument();
  });

  it('does not expose Edit mode to a read-only user', () => {
    mockUseAuth.mockReturnValue({
      isAdminUser: false,
      isFirstTimeUser: false,
    });

    render(<OntologyExplorerPage />);

    expect(screen.queryByTestId('mode-tab-edit')).not.toBeInTheDocument();
    expect(screen.getByTestId('mode-tab-view')).toBeVisible();
    expect(screen.getByTestId('mode-tab-query')).toBeVisible();
  });

  it('does not expose an AI affordance when the effective flag is disabled', () => {
    render(<OntologyExplorerPage />);

    expect(screen.queryByTestId('mode-tab-ai')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-ai-assistant')
    ).not.toBeInTheDocument();
  });

  it('mounts the assistant only after the effective flag is enabled', () => {
    mockUseOntologyAiCapability.mockReturnValue({
      isEnabled: true,
      isLoading: false,
      isRdfEnabled: true,
    });

    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-ai'));

    expect(screen.getByTestId('ontology-ai-assistant')).toBeInTheDocument();
    expect(screen.queryByTestId('ontology-explorer')).not.toBeInTheDocument();
  });

  it('opens generated SPARQL in the console without executing it', () => {
    mockUseOntologyAiCapability.mockReturnValue({
      isEnabled: true,
      isLoading: false,
      isRdfEnabled: true,
    });

    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-ai'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open generated query' })
    );

    expect(screen.getByTestId('sparql-query-console')).toBeInTheDocument();
    expect(mockQueryConsole).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialQuery: 'SELECT ?term WHERE {}' })
    );
  });
});
