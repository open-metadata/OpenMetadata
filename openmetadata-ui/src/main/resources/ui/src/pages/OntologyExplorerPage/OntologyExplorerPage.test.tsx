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

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { Glossary } from '../../generated/entity/data/glossary';
import { Ontology } from '../../generated/entity/data/ontology';
import { OntologyConceptType } from '../../generated/entity/data/ontologyConcept';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import {
  getOntology,
  getOntologyWorkingDiff,
  listOntologies,
  listOntologyAxioms,
  listOntologyConcepts,
  listOntologyProperties,
} from '../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { showInfoToast } from '../../utils/ToastUtils';
import OntologyExplorerPage from './OntologyExplorerPage';

const render = renderWithQueryClient;

let mockSearchParams = new URLSearchParams('scope=glossary:all');
let mockUseRealRouter = false;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: () =>
    mockUseRealRouter
      ? jest.requireActual('react-router-dom').useSearchParams()
      : jest.requireActual('react').useState(mockSearchParams),
}));

jest.mock('../../rest/ontologyAPI', () => ({
  ...jest.requireActual('../../rest/ontologyAPI'),
  getOntologyConceptBindings: jest
    .fn()
    .mockResolvedValue({ revision: 0, assets: [] }),
  getOntology: jest.fn(),
  getOntologyWorkingDiff: jest.fn(),
  listOntologyAxioms: jest.fn(),
  listOntologies: jest.fn(),
  listOntologyConcepts: jest.fn(),
  listOntologyProperties: jest.fn(),
}));

jest.mock('../../rest/permissionAPI', () => ({
  ...jest.requireActual('../../rest/permissionAPI'),
  getEntityPermissionById: jest.fn().mockResolvedValue({ operations: [] }),
}));

jest.mock('../../components/OntologyExplorer/OntologyGraphG6', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: forwardRef(
      (
        {
          nodes,
          onNodeClick,
        }: import('../../components/OntologyExplorer/OntologyExplorer.interface').OntologyGraphProps,
        _ref
      ) => (
        <div data-testid="native-canvas">
          {nodes.map((node) => (
            <button key={node.id} onClick={() => onNodeClick(node)}>
              {node.label}
            </button>
          ))}
        </div>
      )
    ),
  };
});

interface ExplorerMockProps {
  conceptDraftId?: string;
  defaultConceptGlossaryId?: string;
  isAuthoringMode?: boolean;
  isEditMode?: boolean;
  onConceptDraftClose?: () => void;
  onGlossariesChange?: (glossaries: Glossary[]) => void;
  onRequestEdit?: () => void;
  onSelectedNodeChange?: (node: { glossaryId?: string } | null) => void;
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
  onOpenGlossary?: (glossaryName: string) => void;
}

const mockOntologyExplorer = jest.fn<void, [ExplorerMockProps]>();
const mockQueryConsole = jest.fn<void, [QueryConsoleMockProps]>();
const mockUseOntologyAiCapability = jest.fn(() => ({
  isEnabled: false,
  isLoading: false,
  isRdfEnabled: true,
}));
const mockUseOntologyEditLease = jest.fn((_options?: unknown) => ({
  isOwned: true,
  lock: undefined,
  retry: jest.fn(),
  state: 'owned' as const,
}));
const mockUseOntologyStudioScopes = jest.fn(() => ({
  glossaries: [] as Glossary[],
  isError: false,
  isLoading: false,
  isOntologyError: false,
  isOntologyLoading: false,
  refetchOntologies: jest.fn(),
  ontologies: [] as Ontology[],
  refetch: jest.fn(),
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

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: jest.fn(),
}));

jest.mock('../../hooks/governance/ontology/useOntologyStudioScopes', () => ({
  useOntologyConceptCounts: () => ({}),
  useOntologyStudioScopes: ({
    knownGlossaries,
  }: {
    knownGlossaries: Glossary[];
  }) => ({
    ...mockUseOntologyStudioScopes(),
    glossaries: knownGlossaries.length
      ? knownGlossaries
      : mockUseOntologyStudioScopes().glossaries,
  }),
}));

jest.mock('../../hooks/governance/ontology/useOntologyEditLease', () => ({
  useOntologyEditLease: (options: unknown) => mockUseOntologyEditLease(options),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showInfoToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(() => ({ permissions: {} })),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: PageLayoutMockProps) => (
    <div data-testid="page-layout-v1">{children}</div>
  ),
}));

jest.mock('../../components/OntologyExplorer/OntologyExplorer', () => ({
  __esModule: true,
  default: jest.fn((props: ExplorerMockProps) => {
    mockOntologyExplorer(props);

    return (
      <div data-testid="ontology-explorer">
        <input aria-label="Concept search" />
      </div>
    );
  }),
}));

jest.mock('../../components/OntologyExplorer/OntologyLibrary', () => ({
  __esModule: true,
  default: jest.fn(({ onClose, onOpenGlossary }: LibraryMockProps) => (
    <div data-testid="ontology-library">
      <button type="button" onClick={onClose}>
        Close library
      </button>
      <button
        type="button"
        onClick={() => onOpenGlossary?.('InstalledGlossary')}>
        Open installed glossary
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

jest.mock(
  '../../components/OntologyExplorer/OntologyMemoryReviewPanel',
  () => ({
    __esModule: true,
    default: jest.fn(() => <div data-testid="ontology-memory-review-panel" />),
  })
);

jest.mock('../../components/OntologyExplorer/OntologyImportExportMenu', () => ({
  __esModule: true,
  default: jest.fn(() => {
    const { useState } = jest.requireActual<typeof import('react')>('react');
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div data-testid="ontology-import-export">
        <button type="button" onClick={() => setIsOpen(true)}>
          Open mock import
        </button>
        {isOpen && <div data-testid="open-import-preview" />}
      </div>
    );
  }),
}));

jest.mock(
  '../../components/governance/ontology/OntologyConceptEditor/OntologyConceptEditor',
  () => ({
    __esModule: true,
    default: ({ onSaved }: { onSaved: (saved: unknown) => void }) => (
      <div data-testid="ontology-concept-editor">
        <button
          type="button"
          onClick={() =>
            onSaved({ id: 'saved-concept', name: 'Saved concept', version: 1 })
          }>
          Save mock concept
        </button>
      </div>
    ),
  })
);

jest.mock(
  '../../components/governance/ontology/OntologyReleasePanel/OntologyReleasePanel',
  () => ({
    __esModule: true,
    default: () => <div data-testid="ontology-release-panel" />,
  })
);

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
    (useEntityPermissions as jest.Mock).mockReturnValue({ canEditAll: true });
    mockUseRealRouter = false;
    mockSearchParams = new URLSearchParams('scope=glossary:all');
    mockUseAuth.mockReturnValue({
      isAdminUser: true,
      isFirstTimeUser: false,
    });
    mockUseOntologyAiCapability.mockReturnValue({
      isEnabled: false,
      isLoading: false,
      isRdfEnabled: true,
    });
    mockUseOntologyStudioScopes.mockReturnValue({
      glossaries: [],
      isError: false,
      isLoading: false,
      isOntologyError: false,
      isOntologyLoading: false,
      refetchOntologies: jest.fn(),
      ontologies: [],
      refetch: jest.fn(),
    });
  });

  const nativeOntology: Ontology = {
    id: 'native-sales',
    name: 'Native sales',
    fullyQualifiedName: 'NativeSales',
    iri: 'urn:NativeSales',
    namespace: 'urn:NativeSales:',
  };

  const Location = () => (
    <output data-testid="location">{useLocation().search}</output>
  );

  const renderNativeStudio = (search: string) => {
    (usePermissionProvider as jest.Mock).mockReturnValue({
      permissions: {
        ontologyConcept: { Create: true },
        ontologyProperty: { Create: true },
        ontologyAxiom: { Create: true },
      },
    });
    mockUseRealRouter = true;
    (getOntology as jest.Mock).mockResolvedValue(nativeOntology);
    (getOntologyWorkingDiff as jest.Mock).mockResolvedValue({
      state: {
        ontologyId: nativeOntology.id,
        activationRevision: 0,
        workingRevision: 1,
        lastReleaseRevision: 0,
      },
      data: [],
      paging: { total: 0 },
    });
    (listOntologies as jest.Mock).mockResolvedValue({
      data: [nativeOntology],
      paging: { total: 1 },
    });
    mockUseOntologyStudioScopes.mockReturnValue({
      glossaries: [],
      isError: false,
      isLoading: false,
      isOntologyError: false,
      isOntologyLoading: false,
      refetchOntologies: jest.fn(),
      ontologies: [nativeOntology],
      refetch: jest.fn(),
    });
    (listOntologyConcepts as jest.Mock).mockResolvedValue({
      data: ['Party', 'Customer'].map((name) => ({
        id: name,
        name,
        iri: `urn:${name}`,
        fullyQualifiedName: `NativeSales.${name}`,
        ontology: { id: nativeOntology.id, type: 'ontology' },
        conceptType: OntologyConceptType.OwlClass,
        superClasses: name === 'Customer' ? ['urn:Party'] : [],
      })),
      paging: { total: 2 },
    });
    (listOntologyProperties as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    (listOntologyAxioms as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    return renderWithQueryClient(
      <MemoryRouter initialEntries={[`/${search}`]}>
        <OntologyExplorerPage />
        <Location />
      </MemoryRouter>
    );
  };

  it('shows the empty native catalog without glossary controls', async () => {
    mockSearchParams = new URLSearchParams();
    render(<OntologyExplorerPage />);

    expect(await screen.findByTestId('all-ontologies-empty')).toBeVisible();
    expect(mockOntologyExplorer).not.toHaveBeenCalled();
    expect(screen.getByTestId('ontology-library-trigger')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-publication-trigger'));

    expect(screen.getByTestId('ontology-publication-picker')).toHaveTextContent(
      'message.no-data-available'
    );
  });

  it('opens Releases from the version chip and Changes from Publish', async () => {
    renderNativeStudio('?ontology=native-sales');
    fireEvent.click(
      await screen.findByTestId('ontology-release-history-trigger')
    );

    expect(
      screen.getByTestId('ontology-publication-tab-releases')
    ).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'label.close' }));
    fireEvent.click(screen.getByTestId('ontology-publication-trigger'));

    expect(
      screen.getByTestId('ontology-publication-tab-changes')
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('shows native list failure without falling back to glossary data', async () => {
    mockSearchParams = new URLSearchParams();
    mockUseOntologyStudioScopes.mockReturnValue({
      glossaries: [],
      isError: true,
      isLoading: false,
      isOntologyError: true,
      isOntologyLoading: false,
      ontologies: [],
      refetch: jest.fn(),
      refetchOntologies: jest.fn(),
    });
    render(<OntologyExplorerPage />);

    expect(screen.getByTestId('all-ontologies-load-error')).toBeVisible();
    expect(mockOntologyExplorer).not.toHaveBeenCalled();
    expect(screen.getByTestId('ontology-publication-trigger')).toBeDisabled();
  });

  it('defaults to a read-only native graph and opens the owning ontology', async () => {
    renderNativeStudio('');

    expect(await screen.findByTestId('all-ontologies-graph')).toBeVisible();
    expect(screen.getByTestId('ontology-library-trigger')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-edit-ontology')
    ).not.toBeInTheDocument();
    expect(mockOntologyExplorer).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Customer' }));
    fireEvent.click(screen.getByTestId('ontology-concept-edit'));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        'ontology=native-sales'
      )
    );
  });

  it('chooses a publication owner from All ontologies before opening changes', async () => {
    renderNativeStudio('');
    fireEvent.click(screen.getByTestId('ontology-publication-trigger'));

    expect(screen.getByTestId('ontology-publication-picker')).toBeVisible();

    fireEvent.click(
      screen.getByTestId('ontology-publication-select-native-sales')
    );

    expect(
      await screen.findByTestId('ontology-publication-tab-changes')
    ).toBeVisible();
    expect(screen.getByTestId('ontology-publication-modal')).toHaveTextContent(
      nativeOntology.name
    );
    expect(screen.getByTestId('location')).not.toHaveTextContent('ontology=');
  });

  it('switches from a glossary draft to a native tree and releases the glossary lease', async () => {
    renderNativeStudio('?draft=glossary-draft');
    const glossary: Glossary = {
      id: 'glossary-id',
      name: 'Business glossary',
      description: '',
    };
    act(() =>
      mockOntologyExplorer.mock.calls
        .at(-1)?.[0]
        .onGlossariesChange?.([glossary])
    );
    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(
      screen.getByRole('menuitemradio', { name: /Business glossary/ })
    );
    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(mockUseOntologyEditLease).toHaveBeenLastCalledWith(
      expect.objectContaining({ isActive: true })
    );

    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(await screen.findByTestId('ontology-scope-native-sales'));

    expect(screen.getByTestId('mode-tab-view')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByTestId('mode-tab-model')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mode-tab-releases')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('ontology-studio-header')).toHaveLength(1);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '?ontology=native-sales'
    );
    expect(screen.getByTestId('location')).not.toHaveTextContent('draft=');
    expect(mockUseOntologyEditLease).toHaveBeenLastCalledWith(
      expect.objectContaining({ isActive: false })
    );

    fireEvent.click(await screen.findByTestId('submode-tab-tree'));
    await waitFor(() =>
      expect(screen.getByTestId('ontology-tree-term-Customer')).toBeVisible()
    );

    expect(screen.getByTestId('ontology-tree-term-Party')).toBeVisible();
  });

  it('keeps a native draft deep link in its selected ontology review', async () => {
    renderNativeStudio('?ontology=native-sales&draft=native-draft');

    await screen.findByTestId('ontology-memory-review-panel');

    expect(screen.getByTestId('location')).toHaveTextContent(
      'draft=native-draft'
    );
    expect(screen.getByTestId('ontology-memory-review-panel')).toBeVisible();
    expect(screen.queryByTestId('mode-tab-review')).not.toBeInTheDocument();
    expect(mockUseOntologyEditLease).toHaveBeenLastCalledWith(
      expect.objectContaining({ isActive: false })
    );
  });

  it('invalidates the header working count after a native definition save', async () => {
    renderNativeStudio('?ontology=native-sales');
    await screen.findByTestId('native-canvas');

    expect(
      screen.getByTestId('ontology-publication-trigger')
    ).toHaveTextContent('(0)');

    fireEvent.click(screen.getByTestId('mode-tab-edit'));
    fireEvent.click(screen.getByTestId('submode-tab-definitions'));
    fireEvent.click(await screen.findByTestId('ontology-add-concept'));
    (getOntologyWorkingDiff as jest.Mock).mockResolvedValue({
      state: {
        ontologyId: nativeOntology.id,
        activationRevision: 0,
        workingRevision: 2,
        lastReleaseRevision: 0,
      },
      data: [],
      paging: { total: 1 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save mock concept' }));

    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-publication-trigger')
      ).toHaveTextContent('(1)')
    );
  });

  it('closes an import preview when the selected ontology changes', async () => {
    const otherOntology: Ontology = {
      ...nativeOntology,
      id: 'native-other',
      name: 'Other',
      fullyQualifiedName: 'Other',
    };
    renderNativeStudio('?ontology=native-sales');
    (getOntology as jest.Mock).mockImplementation(async (id) =>
      id === otherOntology.id ? otherOntology : nativeOntology
    );
    mockUseOntologyStudioScopes.mockReturnValue({
      glossaries: [],
      isError: false,
      isLoading: false,
      isOntologyError: false,
      isOntologyLoading: false,
      refetchOntologies: jest.fn(),
      ontologies: [nativeOntology, otherOntology],
      refetch: jest.fn(),
    });
    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByRole('button', { name: 'Open mock import' }));

    expect(screen.getByTestId('open-import-preview')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(await screen.findByTestId('ontology-scope-native-other'));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('native-other')
    );

    expect(screen.queryByTestId('open-import-preview')).not.toBeInTheDocument();
  });

  it('uses the shared Studio shell for a native ontology', async () => {
    renderNativeStudio('?ontology=native-sales');

    await screen.findByTestId('native-canvas');

    expect(screen.getAllByTestId('ontology-studio-header')).toHaveLength(1);
    expect(screen.getByTestId('ontology-scope-menu-trigger')).toHaveTextContent(
      nativeOntology.name
    );
    expect(screen.getByTestId('mode-tab-view')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('mode-tab-edit')).toBeVisible();
    expect(screen.getByTestId('mode-tab-query')).toBeVisible();
    expect(screen.getByTestId('submode-tab-graph')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByTestId('mode-tab-graph')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mode-tab-model')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mode-tab-releases')).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-import-export')).toBeVisible();
    expect(screen.getByTestId('ontology-explorer-stats')).toHaveTextContent(
      '2 label.concept-plural · 0 label.relation-plural'
    );
    expect(screen.getByText('2 label.isolated')).toBeVisible();
  });

  it('keeps the native canvas in Edit and starts concept authoring from the shared header', async () => {
    renderNativeStudio('?ontology=native-sales');

    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('submode-tab-tree'));

    expect(screen.getByTestId('ontology-tree-view')).toBeVisible();

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(screen.getByTestId('native-canvas')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-model-concept')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-add-concept'));

    expect(await screen.findByTestId('ontology-concept-editor')).toBeVisible();
  });

  it('starts a new query in the selected native ontology', async () => {
    renderNativeStudio('?ontology=native-sales');
    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('mode-tab-query'));
    fireEvent.click(screen.getByTestId('ontology-new-query'));

    expect(mockQueryConsole).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createQueryOnMount: true,
        selectedOntologyId: nativeOntology.id,
      })
    );
  });

  it('preserves the builder surface when changing from glossary to native scope', async () => {
    renderNativeStudio('?scope=glossary:all');
    fireEvent.click(screen.getByTestId('mode-tab-query'));
    fireEvent.click(screen.getByTestId('submode-tab-builder'));

    expect(screen.getByTestId('visual-query-builder')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(await screen.findByTestId('ontology-scope-native-sales'));
    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('mode-tab-query'));

    expect(screen.getByTestId('visual-query-builder')).toBeVisible();
    expect(
      screen.queryByTestId('sparql-query-console')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('submode-tab-builder')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('opens the graph editor for a concept owner after visiting Definitions', async () => {
    (useEntityPermissions as jest.Mock).mockImplementation((resource) => ({
      canEditAll: resource === 'ontologyConcept',
    }));
    mockUseAuth.mockReturnValue({ isAdminUser: false, isFirstTimeUser: false });
    renderNativeStudio('?ontology=native-sales');
    (usePermissionProvider as jest.Mock).mockReturnValue({ permissions: {} });
    await screen.findByTestId('native-canvas');

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(
      screen.queryByTestId('ontology-add-concept')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('submode-tab-definitions'));
    fireEvent.click(screen.getByTestId('mode-tab-view'));
    fireEvent.click(screen.getByTestId('submode-tab-tree'));
    fireEvent.click(screen.getByTestId('ontology-tree-term-Customer'));
    fireEvent.click(screen.getByTestId('ontology-concept-edit'));

    expect(await screen.findByTestId('ontology-concept-editor')).toBeVisible();
    expect(screen.getByTestId('native-canvas')).toBeVisible();
    expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('opens native Changes and Releases from the shared Publish action', async () => {
    renderNativeStudio('?ontology=native-sales');

    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('ontology-publication-trigger'));

    expect(screen.getByTestId('ontology-publication-modal')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'label.close' }));

    expect(
      screen.queryByTestId('ontology-publication-modal')
    ).not.toBeInTheDocument();
  });

  it('renders the dedicated Studio shell and graph by default', () => {
    render(<OntologyExplorerPage />);

    expect(
      screen.getByRole('heading', { name: 'label.ontology-studio' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('page-layout-v1')).toBeInTheDocument();
    expect(screen.getByTestId('ontology-studio-shell').className).not.toContain(
      'tw:fixed'
    );
    expect(screen.getByTestId('mode-tab-view')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('submode-tab-graph')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.getByTestId('ontology-scope-menu-trigger')
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
    expect(screen.getByTestId('ontology-explorer')).not.toBeVisible();
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

  it('keeps glossary editing on the relations graph without ontology modeling', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(screen.getByTestId('submode-tab-graph')).toBeInTheDocument();
    expect(screen.queryByTestId('submode-tab-model')).not.toBeInTheDocument();
    expect(screen.queryByTestId('submode-tab-term')).not.toBeInTheDocument();
    expect(screen.queryByTestId('submode-tab-bulk')).not.toBeInTheDocument();
  });

  it('starts an inline concept draft without selecting a glossary first', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    const addConceptButton = screen.getByTestId('ontology-add-concept');

    expect(addConceptButton).toBeEnabled();
    expect(
      screen.queryByTestId('ontology-edit-lease-status')
    ).not.toBeInTheDocument();

    fireEvent.click(addConceptButton);

    const draftExplorerProps = mockOntologyExplorer.mock.calls.at(-1)?.[0];

    expect(draftExplorerProps?.conceptDraftId).toMatch(
      /^ontology-concept-draft-/
    );
    expect(draftExplorerProps?.defaultConceptGlossaryId).toBeUndefined();
    expect(addConceptButton).toBeDisabled();

    act(() => draftExplorerProps?.onConceptDraftClose?.());

    expect(screen.getByTestId('ontology-add-concept')).toBeEnabled();
  });

  it('prefills the inline draft with the selected Edit graph glossary', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    const explorerProps = mockOntologyExplorer.mock.calls.at(-1)?.[0];
    const glossary: Glossary = {
      description: 'Customer lifecycle ontology',
      id: 'customer-lifecycle-id',
      name: 'CustomerLifecycle',
    };

    act(() => explorerProps?.onGlossariesChange?.([glossary]));
    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    const glossaryMenuItem = screen.getByRole('menuitemradio', {
      name: /CustomerLifecycle/,
    });

    expect(glossaryMenuItem).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(glossaryMenuItem);
    fireEvent.click(screen.getByTestId('ontology-add-concept'));

    expect(
      mockOntologyExplorer.mock.calls.at(-1)?.[0].defaultConceptGlossaryId
    ).toBe(glossary.id);
  });

  it('switches the graph and its drawers to Edit when a drawer asks to edit', () => {
    render(<OntologyExplorerPage />);

    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({ isAuthoringMode: false, isEditMode: false })
    );

    act(() => mockOntologyExplorer.mock.calls.at(-1)?.[0].onRequestEdit?.());

    expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isAuthoringMode: true,
        isEditMode: true,
        surface: 'graph',
      })
    );
    expect(showInfoToast).not.toHaveBeenCalled();
  });

  it('retries the lease and names the holder when Edit is asked for again', () => {
    const retry = jest.fn();
    mockUseOntologyEditLease.mockReturnValue({
      isOwned: false,
      lock: {
        holder: { displayName: 'Jane Doe', id: 'u-1', type: 'user' },
      } as never,
      retry,
      state: 'contended' as never,
    });
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-edit'));
    const explorerProps = mockOntologyExplorer.mock.calls.at(-1)?.[0];
    act(() => {
      explorerProps?.onGlossariesChange?.([
        { description: 'd', id: 'g-1', name: 'Core' },
      ]);
      explorerProps?.onSelectedNodeChange?.({ glossaryId: 'g-1' });
    });
    act(() => mockOntologyExplorer.mock.calls.at(-1)?.[0].onRequestEdit?.());

    expect(retry).toHaveBeenCalled();
    expect(showInfoToast).toHaveBeenCalledWith('message.ontology-edit-held-by');

    mockUseOntologyEditLease.mockReset();
    mockUseOntologyEditLease.mockImplementation(() => ({
      isOwned: true,
      lock: undefined,
      retry: jest.fn(),
      state: 'owned' as const,
    }));
  });

  it('prefills the inline draft from a selected node in all-glossaries mode', () => {
    render(<OntologyExplorerPage />);

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    const explorerProps = mockOntologyExplorer.mock.calls.at(-1)?.[0];
    const glossary: Glossary = {
      description: 'Customer lifecycle ontology',
      id: 'customer-lifecycle-id',
      name: 'CustomerLifecycle',
    };

    act(() => {
      explorerProps?.onGlossariesChange?.([glossary]);
      explorerProps?.onSelectedNodeChange?.({ glossaryId: glossary.id });
    });

    const addConceptButton = screen.getByTestId('ontology-add-concept');

    expect(addConceptButton).toBeEnabled();

    fireEvent.click(addConceptButton);

    expect(
      mockOntologyExplorer.mock.calls.at(-1)?.[0].defaultConceptGlossaryId
    ).toBe(glossary.id);
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

  it.each([
    ['Query to View', ['mode-tab-query', 'mode-tab-view']],
    [
      'the recorded mode sequence',
      ['mode-tab-edit', 'mode-tab-query', 'mode-tab-edit', 'mode-tab-view'],
    ],
    ['AI to View', ['mode-tab-ai', 'mode-tab-view']],
  ])('preserves the explorer and its search through %s', (_scenario, tabs) => {
    mockUseOntologyAiCapability.mockReturnValue({
      isEnabled: true,
      isLoading: false,
      isRdfEnabled: true,
    });
    render(<OntologyExplorerPage />);
    const explorer = screen.getByTestId('ontology-explorer');
    const search = screen.getByRole('textbox', { name: 'Concept search' });
    fireEvent.change(search, { target: { value: 'Account' } });

    for (const tab of tabs) {
      fireEvent.click(screen.getByTestId(tab));
    }

    expect(screen.getByTestId('ontology-explorer')).toBe(explorer);
    expect(explorer).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Concept search' })).toHaveValue(
      'Account'
    );
  });

  it('opens the ontology library from the dedicated header action', () => {
    render(<OntologyExplorerPage />);

    expect(screen.queryByTestId('mode-tab-library')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-library-trigger'));

    expect(screen.getByTestId('ontology-library')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close library' }));

    expect(screen.queryByTestId('ontology-library')).not.toBeInTheDocument();
  });

  it('refreshes the explorer and selects a glossary opened from the library', () => {
    render(<OntologyExplorerPage />);

    const originalExplorer = screen.getByTestId('ontology-explorer');

    fireEvent.click(screen.getByTestId('ontology-library-trigger'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open installed glossary' })
    );

    expect(screen.queryByTestId('ontology-library')).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-explorer')).not.toBe(originalExplorer);

    const explorerProps = mockOntologyExplorer.mock.calls.at(-1)?.[0];
    const installedGlossary: Glossary = {
      description: 'Installed ontology pack',
      id: 'installed-glossary-id',
      name: 'InstalledGlossary',
    };

    act(() => explorerProps?.onGlossariesChange?.([installedGlossary]));

    expect(screen.getByTestId('ontology-scope-menu-trigger')).toHaveTextContent(
      installedGlossary.name
    );
  });

  it('does not expose Edit mode to a read-only user', () => {
    mockUseAuth.mockReturnValue({
      isAdminUser: false,
      isFirstTimeUser: false,
    });

    render(<OntologyExplorerPage />);

    expect(screen.queryByTestId('mode-tab-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mode-tab-review')).not.toBeInTheDocument();
    expect(screen.getByTestId('mode-tab-view')).toBeVisible();
    expect(screen.getByTestId('mode-tab-query')).toBeVisible();
  });

  it('lets a user approve AI proposals only with edit rights on glossaries and change sets', () => {
    mockUseAuth.mockReturnValue({ isAdminUser: false, isFirstTimeUser: false });
    const mockPermissions = usePermissionProvider as jest.Mock;
    mockPermissions.mockReturnValue({
      permissions: { glossary: { EditAll: true } },
    });

    render(<OntologyExplorerPage />);

    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        proposalPermissions: { canApprove: false, canReject: false },
      })
    );

    mockPermissions.mockReturnValue({
      permissions: {
        glossary: { EditAll: true },
        ontologyChangeSet: { EditAll: true },
      },
    });
    render(<OntologyExplorerPage />);

    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        proposalPermissions: { canApprove: true, canReject: true },
      })
    );

    mockPermissions.mockReturnValue({ permissions: {} });
  });

  it('hides the Needs review tab from the Studio mode bar', () => {
    render(<OntologyExplorerPage />);

    expect(screen.queryByTestId('mode-tab-review')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-memory-review-panel')
    ).not.toBeInTheDocument();
  });

  it('still opens a linked draft in Studio review without a tab', () => {
    mockSearchParams = new URLSearchParams('draft=draft-16');

    render(<OntologyExplorerPage />);

    expect(screen.getByTestId('ontology-memory-review-panel')).toBeVisible();
    expect(screen.queryByTestId('mode-tab-review')).not.toBeInTheDocument();

    mockSearchParams = new URLSearchParams('scope=glossary:all');
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
    expect(screen.getByTestId('ontology-explorer')).not.toBeVisible();
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
