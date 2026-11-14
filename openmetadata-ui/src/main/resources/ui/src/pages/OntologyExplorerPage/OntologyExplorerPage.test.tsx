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

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosResponse } from 'axios';
import { Profiler, ReactNode, useEffect, useState } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { Glossary } from '../../generated/entity/data/glossary';
import { Ontology } from '../../generated/entity/data/ontology';
import { OntologyConceptType } from '../../generated/entity/data/ontologyConcept';
import { useIsAiMode } from '../../hooks/useAppMode';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import {
  createOntology,
  getNativeOntologyDataGraphPage,
  getOntology,
  getOntologyConcept,
  getOntologyConceptBindings,
  getOntologyWorkingDiff,
  listOntologies,
  listOntologyAxioms,
  listOntologyConcepts,
  listOntologyProperties,
  listOntologyReleaseMembers,
} from '../../rest/ontologyAPI';
import { fetchRdfConfig } from '../../rest/rdfAPI';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../test/unit/enUsTranslation';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { pageFixture } from '../../utils/governance/ontology/OntologyNativeDataGraph.mock';
import { showInfoToast } from '../../utils/ToastUtils';
import OntologyExplorerPage from './OntologyExplorerPage';

let mockUserId = 'admin';
let mockUseRealDrawer = false;
let mockUseRealScopes = false;

jest.mock(
  '../../components/governance/ontology/OntologyTasksDrawer/OntologyTasksDrawer',
  () => ({
    __esModule: true,
    default: ({
      taskId,
      onTaskChange,
      children,
    }: {
      taskId?: string;
      onTaskChange: (id?: string) => void;
      children: (parts: {
        tasksAction: ReactNode;
        banner: ReactNode;
      }) => ReactNode;
    }) => {
      if (mockUseRealDrawer) {
        const Drawer = jest.requireActual<
          typeof import('../../components/governance/ontology/OntologyTasksDrawer/OntologyTasksDrawer')
        >(
          '../../components/governance/ontology/OntologyTasksDrawer/OntologyTasksDrawer'
        ).default;

        return (
          <Drawer taskId={taskId} onTaskChange={onTaskChange}>
            {children}
          </Drawer>
        );
      }

      return (
        <>
          {children({
            tasksAction: (
              <button
                data-testid="ontology-tasks-trigger"
                onClick={() => onTaskChange('review-uuid')}>
                Tasks
              </button>
            ),
            banner: null,
          })}
          {taskId && (
            <section data-testid="ontology-review-drawer">
              <span>{taskId}</span>
              <button onClick={() => onTaskChange(undefined)}>
                Close task
              </button>
            </section>
          )}
        </>
      );
    },
  })
);

const render = renderWithQueryClient;

let mockSearchParams = new URLSearchParams('scope=glossary:all');
let mockUseRealRouter = false;
const mockDialogCommit = jest.fn();
const mockCanvasControls = {
  fitView: jest.fn(),
  zoomIn: jest.fn(),
  zoomOut: jest.fn(),
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: () =>
    mockUseRealRouter
      ? jest.requireActual('react-router-dom').useSearchParams()
      : jest.requireActual('react').useState(mockSearchParams),
}));

jest.mock('../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../rest/tasksAPI'),
  getTaskById: jest.fn(() => new Promise(() => {})),
}));

jest.mock('../../rest/ontologyAPI', () => ({
  ...jest.requireActual('../../rest/ontologyAPI'),
  createOntology: jest.fn(),
  getOntologyConceptBindings: jest
    .fn()
    .mockResolvedValue({ kind: 'complete', revision: 0, assets: [] }),
  getNativeOntologyDataGraphPage: jest.fn(),
  getOntology: jest.fn(),
  getOntologyConcept: jest.fn(),
  getOntologyReleaseReviews: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
  getOntologyWorkingDiff: jest.fn(),
  listOntologyAxioms: jest.fn(),
  listOntologies: jest.fn(),
  listOntologyConcepts: jest.fn(),
  listOntologyProperties: jest.fn(),
  listOntologyReleaseMembers: jest.fn(),
}));

jest.mock('../../rest/rdfAPI', () => ({
  ...jest.requireActual('../../rest/rdfAPI'),
  fetchRdfConfig: jest.fn(),
}));

jest.mock('../../rest/permissionAPI', () => ({
  ...jest.requireActual('../../rest/permissionAPI'),
  getEntityPermissionById: jest.fn().mockResolvedValue({ operations: [] }),
}));

jest.mock('../../components/OntologyExplorer/OntologyGraphG6', () => {
  const { forwardRef, useImperativeHandle } =
    jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: forwardRef(
      (
        {
          nodes,
          onNodeClick,
          onPaneClick,
        }: import('../../components/OntologyExplorer/OntologyExplorer.interface').OntologyGraphProps,
        ref
      ) => {
        useImperativeHandle(ref, () => mockCanvasControls);

        return (
          <div data-testid="native-canvas">
            <button data-testid="native-pane" onClick={onPaneClick}>
              Clear selection
            </button>
            {nodes.map((node) => (
              <button key={node.id} onClick={() => onNodeClick(node)}>
                {node.label}
              </button>
            ))}
          </div>
        );
      }
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
  queryScope?: {
    ontologyName: string;
    version: string;
    releaseVersion?: string;
  };
}

interface PageLayoutMockProps {
  children?: ReactNode;
}

interface LibraryMockProps {
  native?: { onCreated?: () => void };
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

jest.mock('../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: (
    selector?: (store: {
      currentUser: { id: string; displayName: string; name: string };
    }) => unknown
  ) => {
    const store = {
      currentUser: { id: mockUserId, displayName: 'Admin User', name: 'admin' },
    };

    return selector ? selector(store) : store;
  },
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
  ...jest.requireActual(
    '../../hooks/governance/ontology/useOntologyStudioScopes'
  ),
  useOntologyConceptCounts: () => ({}),
  useOntologyStudioScopes: (options: { knownGlossaries: Glossary[] }) =>
    mockUseRealScopes
      ? jest
          .requireActual(
            '../../hooks/governance/ontology/useOntologyStudioScopes'
          )
          .useOntologyStudioScopes(options)
      : {
          ...mockUseOntologyStudioScopes(),
          glossaries: options.knownGlossaries.length
            ? options.knownGlossaries
            : mockUseOntologyStudioScopes().glossaries,
        },
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
  default: jest.fn(({ native, onClose, onOpenGlossary }: LibraryMockProps) => (
    <div data-testid="ontology-library">
      <button type="button" onClick={onClose}>
        Close library
      </button>
      <button type="button" onClick={() => native?.onCreated?.()}>
        Library created an ontology
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
    default: jest.fn(({ onApplied }: { onApplied?: () => void }) => (
      <div data-testid="ontology-memory-review-panel">
        <button onClick={onApplied}>Apply reviewed draft</button>
      </div>
    )),
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
  '../../components/governance/ontology/OntologyAuthoringWorkspace/OntologyConceptCreateDrawer',
  () => ({
    __esModule: true,
    default: ({ onCreated }: { onCreated: () => void }) => (
      <div data-testid="ontology-new-class-panel">
        <button type="button" onClick={() => onCreated()}>
          Save mock concept
        </button>
      </div>
    ),
  })
);

jest.mock(
  '../../components/governance/ontology/OntologyConceptEditor/OntologyConceptEditor',
  () => {
    interface MockEditorInput {
      concept: { displayName?: string };
      onSaved: (saved: unknown) => void;
    }
    const MockEditorFields = ({ concept, onSaved }: MockEditorInput) => (
      <div>
        <span>{concept.displayName}</span>
        <button
          type="button"
          onClick={() =>
            onSaved({ id: 'saved-concept', name: 'Saved concept', version: 1 })
          }>
          Save mock concept
        </button>
      </div>
    );

    return {
      __esModule: true,
      default: (input: MockEditorInput) => (
        <div data-testid="ontology-concept-editor">
          {MockEditorFields(input)}
        </div>
      ),
      useOntologyConceptEditor: (input: MockEditorInput) => ({
        ...input,
        // The panel reads the unsaved synonyms from the form, as the real hook provides it.
        form: {
          getValues: () => [],
          setValue: () => undefined,
          watch: () => [],
        },
        isDirty: false,
        reset: () => undefined,
      }),
      ConceptEditorProvider: ({ children }: { children: ReactNode }) => (
        <div data-testid="ontology-concept-editor">{children}</div>
      ),
      ConceptEditorFields: ({
        editor,
        names,
      }: {
        editor: MockEditorInput;
        names: string[];
      }) => (names.includes('displayName') ? MockEditorFields(editor) : null),
      ConceptEditorMappings: () => null,
      ConceptEditorFooter: () => null,
    };
  }
);

jest.mock(
  '../../components/governance/ontology/OntologyReleasePanel/OntologyReleasePanel',
  () => ({
    __esModule: true,
    default: ({ onOpenTask }: { onOpenTask?: (taskId: string) => void }) => (
      <div data-testid="ontology-release-panel">
        <button onClick={() => onOpenTask?.('review-uuid')}>
          Open review task
        </button>
      </div>
    ),
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
    default: jest.fn(
      ({ onEditAsSparql }: { onEditAsSparql: (query: string) => void }) => (
        <div data-testid="visual-query-builder">
          <button onClick={() => onEditAsSparql('SELECT ?builder WHERE {}')}>
            Edit generated query
          </button>
        </div>
      )
    ),
  })
);

// A released ontology: the server count is shown as is, with no first-release adjustment.
const RELEASED = { releaseId: 'release-1', releaseRevision: 1 };

describe('OntologyExplorerPage', () => {
  beforeEach(() => {
    (useIsAiMode as jest.Mock).mockReturnValue(false);
    jest.clearAllMocks();
    mockUserId = 'admin';
    mockUseRealDrawer = false;
    mockUseRealScopes = false;
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
    publicationStatus: {
      unpublishedChanges: 0,
      active: {
        releaseId: 'native-sales-release',
        releaseRevision: 1,
        semanticVersion: '1.0.0',
      },
    },
  };

  const Location = () => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
      <>
        <output data-testid="location">{location.search}</output>
        <button data-testid="history-back" onClick={() => navigate(-1)}>
          History back
        </button>
        <button data-testid="history-forward" onClick={() => navigate(1)}>
          History forward
        </button>
        <button
          onClick={() =>
            navigate('?ontology=native-sales&source=review&task=review-uuid')
          }>
          Task route
        </button>
        <button
          data-testid="deselect-concept"
          onClick={() => navigate('?ontology=native-sales&mode=edit')}>
          Deselect concept
        </button>
      </>
    );
  };

  const renderNativeStudio = (
    search: string,
    ontology: Ontology = nativeOntology,
    permissions: Record<string, { Create: boolean }> = {
      ontologyConcept: { Create: true },
      ontologyChangeSet: { Create: true },
      ontologyProperty: { Create: true },
      ontologyAxiom: { Create: true },
    },
    conceptNames: string[] = ['Party', 'Customer'],
    ontologies: Ontology[] = [ontology]
  ) => {
    (usePermissionProvider as jest.Mock).mockReturnValue({ permissions });
    mockUseRealRouter = true;
    (getOntology as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'does-not-exist') {
        throw new AxiosError('missing', '404', undefined, undefined, {
          status: 404,
        } as AxiosResponse);
      }

      return ontology;
    });
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
      data: ontologies,
      paging: { total: ontologies.length },
    });
    mockUseOntologyStudioScopes.mockReturnValue({
      glossaries: [],
      isError: false,
      isLoading: false,
      isOntologyError: false,
      isOntologyLoading: false,
      refetchOntologies: jest.fn(),
      ontologies,
      refetch: jest.fn(),
    });
    (listOntologyConcepts as jest.Mock).mockImplementation(
      async ({ ontology: ontologyFqn }: { ontology?: string }) => {
        const owner =
          ontologies.find((item) => item.fullyQualifiedName === ontologyFqn) ??
          ontology;
        const names =
          owner.id === ontology.id
            ? conceptNames
            : [`${owner.fullyQualifiedName}Concept`];

        return {
          data: names.map((name) => ({
            id: name,
            name,
            description: `${name} working draft`,
            iri: `urn:${name}`,
            fullyQualifiedName: `${owner.fullyQualifiedName}.${name}`,
            ontology: { id: owner.id, type: 'ontology' },
            conceptType: OntologyConceptType.OwlClass,
            superClasses: name === 'Customer' ? ['urn:Party'] : [],
          })),
          paging: { total: names.length },
        };
      }
    );
    (listOntologyReleaseMembers as jest.Mock).mockImplementation(
      async (_releaseId: string, kind: string) => {
        const members =
          kind === 'CONCEPT'
            ? conceptNames.map((name) => ({
                memberId: name,
                memberKind: kind,
                payload: {
                  id: name,
                  name,
                  description: `${name} as released`,
                  iri: `urn:${name}`,
                  fullyQualifiedName: `${ontology.fullyQualifiedName}.${name}`,
                  ontology: { id: ontology.id, type: 'ontology' },
                  conceptType: OntologyConceptType.OwlClass,
                },
              }))
            : [];

        return { data: members, paging: { total: members.length } };
      }
    );
    (listOntologyProperties as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    (listOntologyAxioms as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    const renderStudio = () => (
      <MemoryRouter initialEntries={[`/${search}`]}>
        <Profiler
          id="studio"
          onRender={() =>
            mockDialogCommit(
              screen.queryAllByRole('dialog', { hidden: true }).length
            )
          }>
          <OntologyExplorerPage />
        </Profiler>
        <Location />
      </MemoryRouter>
    );
    const result = renderWithQueryClient(renderStudio());

    return {
      ...result,
      changeAccount: (id: string) => {
        mockUserId = id;
        result.rerender(renderStudio());
      },
    };
  };

  it.each(['back', 'forward'] as const)(
    'hands publication to the task drawer on history %s without reopening publication',
    async (direction) => {
      mockUseRealDrawer = true;
      renderNativeStudio(
        direction === 'back'
          ? '?ontology=native-sales&source=review&task=review-uuid'
          : '?ontology=native-sales&source=review'
      );

      if (direction === 'back') {
        fireEvent.click(await screen.findByTestId('ontology-tasks-close'));
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Task route' }));
        await screen.findByTestId('ontology-tasks-close');
        fireEvent.click(screen.getByTestId('history-back'));
      }

      expect(screen.getByTestId('location')).not.toHaveTextContent('task=');

      fireEvent.click(
        await screen.findByTestId('ontology-publication-trigger')
      );

      expect(
        await screen.findByTestId('ontology-publication-modal')
      ).toBeInTheDocument();
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1);

      fireEvent.click(screen.getByTestId('history-' + direction));

      expect(screen.getByTestId('location')).toHaveTextContent(
        'task=review-uuid'
      );
      expect(
        await screen.findByTestId('ontology-tasks-close')
      ).toBeInTheDocument();
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1);
      expect(mockDialogCommit.mock.calls.every(([count]) => count <= 1)).toBe(
        true
      );
      expect(
        screen.queryByTestId('ontology-publication-modal')
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('ontology-tasks-close'));

      expect(screen.getByTestId('location')).toHaveTextContent(
        'ontology=native-sales'
      );
      expect(screen.getByTestId('location')).toHaveTextContent('source=review');
      expect(screen.getByTestId('location')).not.toHaveTextContent('task=');
      expect(
        screen.queryByTestId('ontology-publication-modal')
      ).not.toBeInTheDocument();
      expect(screen.queryAllByRole('dialog', { hidden: true })).toHaveLength(0);
    }
  );

  it.each([
    '?ontology=native-sales&source=review',
    '?ontology=native-sales&source=review&task=',
  ])(
    'hands publication task UUIDs to the drawer and preserves query context for %s',
    async (search) => {
      mockUseRealRouter = true;
      renderNativeStudio(search);
      fireEvent.click(
        await screen.findByTestId('ontology-publication-trigger')
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Open review task' })
      );

      expect(
        screen.queryByTestId('ontology-publication-modal')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('ontology-review-drawer')).toHaveTextContent(
        'review-uuid'
      );
      expect(screen.getByTestId('location')).toHaveTextContent(
        'task=review-uuid'
      );
      expect(screen.getByTestId('location')).toHaveTextContent('source=review');

      fireEvent.click(screen.getByRole('button', { name: 'Close task' }));

      expect(screen.getByTestId('location')).not.toHaveTextContent('task=');
      expect(screen.getByTestId('location')).toHaveTextContent('source=review');
    }
  );

  it('keeps UUID task selection while graph scope changes', async () => {
    mockUseRealRouter = true;
    renderNativeStudio('?ontology=native-sales&task=review-uuid&source=review');

    expect(
      await screen.findByTestId('ontology-review-drawer')
    ).toHaveTextContent('review-uuid');

    fireEvent.click(await screen.findByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(screen.getByTestId('ontology-scope-all-ontologies'));

    expect(screen.getByTestId('ontology-review-drawer')).toHaveTextContent(
      'review-uuid'
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      'task=review-uuid'
    );
  });

  it.each([false, true])(
    'replaces the canvas with the first-run empty state and keeps only Library, Import/export and Tasks (AI mode %s)',
    async (aiMode) => {
      (useIsAiMode as jest.Mock).mockReturnValue(aiMode);
      mockSearchParams = new URLSearchParams();
      render(
        <MemoryRouter>
          <OntologyExplorerPage />
        </MemoryRouter>
      );

      expect(await screen.findByTestId('ontology-empty-state')).toBeVisible();
      expect(
        screen.getByRole('heading', { name: 'label.no-ontologies-yet' })
      ).toBeVisible();
      expect(
        screen
          .getAllByRole('button', {
            name: /^label\.(install|import-a|create-from)/,
          })
          .map((button) => button.textContent)
      ).toEqual([
        'label.install-from-library',
        'label.import-a-file',
        'label.create-from-scratch',
      ]);

      ['view', 'edit', 'query'].forEach((mode) =>
        expect(screen.queryByTestId(`mode-tab-${mode}`)).not.toBeInTheDocument()
      );

      expect(
        screen.queryByTestId('ontology-publication-trigger')
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('submode-tab-graph')).not.toBeInTheDocument();
      expect(mockOntologyExplorer).not.toHaveBeenCalled();
      expect(screen.getByTestId('ontology-library-trigger')).toBeVisible();
      expect(screen.getByTestId('ontology-import-export')).toBeVisible();
      expect(screen.getByTestId('ontology-tasks-trigger')).toBeVisible();
    }
  );

  it('does not flash the empty state while the first ontology list loads', async () => {
    mockUseRealScopes = true;
    mockSearchParams = new URLSearchParams();
    let resolveList:
      | ((page: { data: Ontology[]; paging: object }) => void)
      | undefined;
    (listOntologies as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      })
    );
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('ontology-studio-shell')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-empty-state')
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveList?.({ data: [], paging: { total: 0 } });
    });

    expect(await screen.findByTestId('ontology-empty-state')).toBeVisible();
  });

  it('holds back the mode switch and Publish while the first ontology list loads', async () => {
    mockUseRealScopes = true;
    mockSearchParams = new URLSearchParams();
    (listOntologies as jest.Mock).mockReturnValue(new Promise(() => undefined));
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('ontology-studio-shell')).toBeVisible();

    ['view', 'edit', 'query'].forEach((mode) =>
      expect(screen.queryByTestId(`mode-tab-${mode}`)).not.toBeInTheDocument()
    );

    expect(
      screen.queryByTestId('ontology-publication-trigger')
    ).not.toBeInTheDocument();
  });

  it('leaves the empty state when the Library installs an ontology, without a reload', async () => {
    mockUseRealScopes = true;
    mockSearchParams = new URLSearchParams();
    (listOntologies as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'label.install-from-library' })
    );
    (listOntologies as jest.Mock).mockResolvedValue({
      data: [nativeOntology],
      paging: { total: 1 },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Library created an ontology' })
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-empty-state')
      ).not.toBeInTheDocument()
    );
  });

  it('opens the Library from the highlighted first-run option', async () => {
    mockSearchParams = new URLSearchParams();
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'label.install-from-library' })
    );

    expect(screen.getByTestId('ontology-library')).toBeVisible();
  });

  it('opens the create dialog from the first-run option', async () => {
    mockSearchParams = new URLSearchParams();
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'label.create-from-scratch' })
    );

    expect(await screen.findByTestId('ontology-create-dialog')).toBeVisible();
  });

  it('opens Import with a new-ontology target from the first-run option', async () => {
    mockSearchParams = new URLSearchParams();
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'label.import-a-file' })
    );

    expect(
      await screen.findByTestId('ontology-native-import-file')
    ).toBeVisible();
    expect(
      screen.getByTestId('ontology-native-import-target')
    ).toHaveTextContent('label.new-ontology');
  });

  it.each([false, true])(
    'tells a user without Create to ask for the OntologyAuthor role instead of showing disabled options (AI mode %s)',
    async (aiMode) => {
      (useIsAiMode as jest.Mock).mockReturnValue(aiMode);
      mockSearchParams = new URLSearchParams();
      mockUseAuth.mockReturnValue({
        isAdminUser: false,
        isFirstTimeUser: false,
      });
      render(
        <MemoryRouter>
          <OntologyExplorerPage />
        </MemoryRouter>
      );

      expect(
        await screen.findByTestId('ontology-empty-no-create')
      ).toHaveTextContent('message.ontology-create-requires-author-role');
      expect(
        screen.getByRole('heading', { name: 'label.no-ontologies-yet' })
      ).toBeVisible();
      expect(
        screen.queryByRole('button', { name: 'label.create-from-scratch' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'label.install-from-library' })
      ).not.toBeInTheDocument();
    }
  );

  it('shows the no-concepts card only while the ontology has zero classes', async () => {
    renderNativeStudio('?ontology=native-sales', nativeOntology, undefined, []);

    expect(await screen.findByTestId('ontology-empty-card')).toBeVisible();
    expect(screen.getByText('label.ontology-has-no-concepts')).toBeVisible();
  });

  it('hides the no-concepts card when the ontology has classes', async () => {
    renderNativeStudio('?ontology=native-sales');

    await screen.findByRole('button', { name: 'Customer' });

    expect(screen.queryByTestId('ontology-empty-card')).not.toBeInTheDocument();
  });

  it('opens the New class panel from the card and from the sub-tab Add concept', async () => {
    renderNativeStudio('?ontology=native-sales', nativeOntology, undefined, []);
    fireEvent.click(
      await screen.findByTestId('ontology-empty-card-add-concept')
    );

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();
    expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
      'aria-selected',
      'true'
    );

    fireEvent.click(screen.getByTestId('ontology-new-class-close'));

    expect(
      screen.queryByTestId('ontology-new-class-panel')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-empty-card')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-add-concept'));

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();
  });

  it('opens Releases from the Releases tab and Changes from Publish', async () => {
    renderNativeStudio('?ontology=native-sales');
    fireEvent.click(await screen.findByTestId('ontology-publication-trigger'));
    fireEvent.click(screen.getByTestId('ontology-publication-tab-releases'));

    expect(
      screen.getByTestId('ontology-publication-tab-releases')
    ).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'label.close' }));
    fireEvent.click(screen.getByTestId('ontology-publication-trigger'));

    expect(
      screen.getByTestId('ontology-publication-tab-changes')
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the published version on the Published switch', async () => {
    renderNativeStudio('?ontology=native-sales', {
      ...nativeOntology,
      publicationStatus: {
        unpublishedChanges: 0,
        active: {
          releaseId: 'release-2',
          releaseRevision: 2,
          semanticVersion: '1.2.0',
        },
      },
    });

    expect(
      await screen.findByTestId('ontology-version-published')
    ).toHaveTextContent('v1.2.0');
  });

  it.each(['isOntologyLoading', 'isOntologyError'] as const)(
    'disables the version switch while the ontology list reports %s',
    async (flag) => {
      renderNativeStudio('?ontology=native-sales');
      mockUseOntologyStudioScopes.mockReturnValue({
        glossaries: [],
        isError: false,
        isLoading: false,
        isOntologyError: false,
        isOntologyLoading: false,
        refetchOntologies: jest.fn(),
        ontologies: [nativeOntology],
        refetch: jest.fn(),
        [flag]: true,
      });

      expect(
        await screen.findByTestId('ontology-version-published')
      ).toBeDisabled();
      expect(screen.getByTestId('ontology-version-draft')).toBeDisabled();
    }
  );

  it.each([false, true])(
    'shows the same three enabled first-run options to a user with Create (AI mode %s)',
    async (aiMode) => {
      (useIsAiMode as jest.Mock).mockReturnValue(aiMode);
      mockSearchParams = new URLSearchParams();
      render(
        <MemoryRouter>
          <OntologyExplorerPage />
        </MemoryRouter>
      );

      const empty = await screen.findByTestId('ontology-empty-state');
      const buttons = within(empty).getAllByRole('button');

      expect(buttons.map((button) => button.textContent)).toEqual([
        'label.install-from-library',
        'label.import-a-file',
        'label.create-from-scratch',
      ]);

      buttons.forEach((button) => expect(button).toBeEnabled());

      fireEvent.click(screen.getByTestId('ontology-empty-scratch'));

      expect(await screen.findByTestId('ontology-create-dialog')).toBeVisible();
    }
  );

  it('creates an ontology from the empty catalog and opens the New class panel in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    mockUseRealScopes = true;
    (listOntologies as jest.Mock).mockResolvedValueOnce({
      data: [],
      paging: { total: 0 },
    });
    (fetchRdfConfig as jest.Mock).mockResolvedValue({
      baseUri: 'https://open-metadata.org/',
    });
    (createOntology as jest.Mock).mockResolvedValue(nativeOntology);
    renderNativeStudio('', nativeOntology, undefined, []);
    fireEvent.click(await screen.findByTestId('ontology-empty-scratch'));

    expect(await screen.findByTestId('ontology-create-dialog')).toBeVisible();

    fireEvent.change(screen.getByTestId('ontology-create-name'), {
      target: { value: 'Native sales' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('ontology-create-submit')).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId('ontology-create-submit'));

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();
    expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(createOntology).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'native-sales',
        displayName: 'Native sales',
      })
    );
  });

  it('shows no separate release-history button to an editor in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    renderNativeStudio('?ontology=native-sales');
    await screen.findByTestId('ontology-version-switch');

    expect(
      screen.queryByTestId('ontology-release-history-trigger')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-publication-trigger'));
    fireEvent.click(screen.getByTestId('ontology-publication-tab-releases'));

    expect(
      screen.getByTestId('ontology-publication-tab-releases')
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('badges the server unpublished count on Publish in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    mockUseRealScopes = true;
    (listOntologies as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          ...nativeOntology,
          publicationStatus: { active: RELEASED, unpublishedChanges: 3 },
        },
      ],
      paging: { total: 1 },
    });
    renderNativeStudio('?ontology=native-sales');

    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-publication-count')
      ).toHaveTextContent('3')
    );

    expect(listOntologies).toHaveBeenCalledTimes(1);
  });

  it.each([
    // Before the first release the server also counts the ontology itself, which is not a change.
    [1, 0, false],
    [9, 8, true],
  ])(
    'counts Publish as the Draft badge does and leads with it only with something to publish (server %s)',
    async (unpublishedChanges, shown, isPrimary) => {
      mockUseRealScopes = true;
      (listOntologies as jest.Mock).mockResolvedValueOnce({
        data: [
          { ...nativeOntology, publicationStatus: { unpublishedChanges } },
        ],
        paging: { total: 1 },
      });
      renderNativeStudio('?ontology=native-sales');

      await waitFor(() =>
        expect(
          screen.getByTestId('ontology-publication-trigger')
        ).toHaveTextContent(`label.publish (${shown})`)
      );

      expect(
        screen
          .getByTestId('ontology-publication-trigger')
          .className.includes('tw:bg-brand-solid')
      ).toBe(isPrimary);
      expect(screen.getByTestId('ontology-publication-trigger')).toBeEnabled();
    }
  );

  it.each([
    [false, 'ontology-publication-trigger', 'label.publish (label.loading)'],
    [true, 'ontology-publication-count', 'label.loading'],
  ])(
    'shows loading on the Publish count while the ontology list loads (AI mode %s)',
    async (aiMode, testId, text) => {
      (useIsAiMode as jest.Mock).mockReturnValue(aiMode);
      mockUseRealScopes = true;
      (listOntologies as jest.Mock).mockReturnValueOnce(
        new Promise(() => undefined)
      );
      renderNativeStudio('?ontology=native-sales');

      expect(await screen.findByTestId(testId)).toHaveTextContent(text);
      expect(
        screen.getByTestId('ontology-publication-trigger')
      ).not.toHaveTextContent('label.unavailable');
    }
  );

  it('opens a review task from the header Tasks action in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    renderNativeStudio('?ontology=native-sales');
    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('ontology-tasks-trigger'));

    expect(screen.getByTestId('ontology-review-drawer')).toHaveTextContent(
      'review-uuid'
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      'task=review-uuid'
    );
  });

  it("asks for a concept in the AI aggregate Data mode, then loads that concept's ontology", async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    (getNativeOntologyDataGraphPage as jest.Mock).mockResolvedValue(
      pageFixture({
        clusters: [
          {
            id: 'Customer',
            name: 'Customer',
            count: 1,
            assets: [{ id: 't1', name: 'customers' }],
          },
        ],
      })
    );
    const financeOntology: Ontology = {
      ...nativeOntology,
      id: 'native-finance',
      name: 'Native finance',
      fullyQualifiedName: 'NativeFinance',
      iri: 'urn:NativeFinance',
      namespace: 'urn:NativeFinance:',
    };
    renderNativeStudio('?source=review', nativeOntology, undefined, undefined, [
      financeOntology,
      nativeOntology,
    ]);
    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));

    expect(screen.getByTestId('ontology-data-empty-state')).toBeVisible();
    expect(getNativeOntologyDataGraphPage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('ontology-graph-mode-model'));
    fireEvent.click(screen.getByRole('button', { name: 'Customer' }));
    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));

    expect(
      await screen.findByTestId('ontology-data-cluster-Customer')
    ).toBeVisible();
    expect(getNativeOntologyDataGraphPage).toHaveBeenCalledWith(
      'native-sales',
      { loaded: [], page: { kind: 'clusters', limit: 12, offset: 0 } },
      expect.any(AbortSignal)
    );
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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('all-ontologies-load-error')).toBeVisible();
    expect(mockOntologyExplorer).not.toHaveBeenCalled();
    expect(screen.getByTestId('ontology-publication-trigger')).toBeDisabled();
  });

  it('keeps Reload and lists no ontology buttons when only the aggregate graph fails', async () => {
    (listOntologyConcepts as jest.Mock).mockRejectedValueOnce(
      new Error('aggregate failed')
    );
    renderNativeStudio('');

    const error = await screen.findByTestId('all-ontologies-load-error');

    expect(
      within(error).queryByRole('button', { name: 'Native sales' })
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(error).getByRole('button', { name: 'label.reload' })
    );

    expect(await screen.findByTestId('all-ontologies-graph')).toBeVisible();
  });

  it('lets the user pick an ontology from the empty state when the catalog passes the aggregate limit', async () => {
    const longName = 'L'.repeat(243);
    const ontologies: Ontology[] = Array.from({ length: 21 }, (_, index) => ({
      ...nativeOntology,
      id: `ontology-${index}`,
      name: index === 0 ? longName : `Ontology ${index}`,
      fullyQualifiedName: index === 0 ? longName : `Ontology${index}`,
    }));
    renderNativeStudio('', ontologies[1], undefined, ['Party'], ontologies);

    const message = await screen.findByTestId('all-ontologies-load-error');

    expect(message).toHaveTextContent('label.choose-an-ontology-to-view');
    expect(message).toHaveTextContent('message.ontology-aggregate-capacity');
    expect(
      screen.queryByTestId('ontology-shortcut-list')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-explorer-stats')).toHaveTextContent(
      /^$/
    );
    expect(
      screen.queryByText(/0 label\.concept-plural/i)
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(message).getByRole('button', { name: /label.select-entity/ })
    );
    fireEvent.click(await screen.findByRole('option', { name: 'Ontology 5' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        'ontology=ontology-5'
      )
    );
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

  it('states why Publish is disabled on All ontologies as visible text, and drops the reason on one ontology', async () => {
    renderNativeStudio('?ontology=native-sales');
    await screen.findByTestId('ontology-publication-trigger');

    expect(
      screen.queryByText('message.ontology-choose-ontology-to-publish')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('ontology-publication-trigger')
    ).not.toHaveAttribute('aria-describedby');
  });

  it('shows why Publish is disabled when the pointer rests on it', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderNativeStudio('');
    const trigger = screen.getByTestId('ontology-publication-trigger');

    expect(trigger).toBeDisabled();

    // react-aria counts hover only after the pointer has moved once.
    fireEvent.mouseMove(document);
    await user.hover(trigger.parentElement as HTMLElement);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'message.ontology-choose-ontology-to-publish'
    );
  });

  it('disables Publish on All ontologies and opens no dialog', async () => {
    renderNativeStudio('');
    const trigger = screen.getByTestId('ontology-publication-trigger');

    expect(trigger).toBeDisabled();

    const reason = screen.getByText(
      'message.ontology-choose-ontology-to-publish'
    );

    expect(reason).toBeVisible();
    expect(trigger).toHaveAttribute('aria-describedby', reason.id);

    fireEvent.click(trigger);

    expect(
      screen.queryByTestId('ontology-publication-modal')
    ).not.toBeInTheDocument();
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

  it('keeps Tasks in the AI header while a memory draft is under review', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    renderNativeStudio('?ontology=native-sales&draft=native-draft');

    await screen.findByTestId('ontology-memory-review-panel');

    expect(screen.getByTestId('ontology-tasks-trigger')).toBeVisible();
  });

  it('offers Add concept on the All ontologies graph and on its Ontology picker', async () => {
    renderNativeStudio('?ontology=native-sales&mode=edit');
    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(screen.getByTestId('ontology-scope-all-ontologies'));
    fireEvent.click(await screen.findByTestId('mode-tab-edit'));

    expect(await screen.findByTestId('ontology-add-concept')).toBeVisible();

    fireEvent.click(await screen.findByTestId('submode-tab-definitions'));

    expect(await screen.findByTestId('ontology-query-picker')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-add-concept'));

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();
    expect(screen.getByTestId('ontology-query-picker')).toBeVisible();
  });

  it('offers Add concept on the Tree view as on the Graph view', async () => {
    renderNativeStudio('?ontology=native-sales&mode=edit');
    await screen.findByTestId('native-canvas');

    expect(screen.getByTestId('ontology-add-concept')).toBeVisible();

    fireEvent.click(screen.getByTestId('submode-tab-tree'));

    expect(await screen.findByTestId('ontology-add-concept')).toBeVisible();
  });

  it('refreshes the server publication count after a native definition save', async () => {
    mockUseRealScopes = true;
    renderNativeStudio('?ontology=native-sales');
    await screen.findByTestId('native-canvas');

    expect(
      screen.getByTestId('ontology-publication-trigger')
    ).toHaveTextContent('(0)');

    fireEvent.click(screen.getByTestId('mode-tab-edit'));
    fireEvent.click(screen.getByTestId('submode-tab-definitions'));
    fireEvent.click(
      await screen.findByRole('tab', { name: 'label.concept-plural' })
    );
    fireEvent.click(await screen.findByTestId('ontology-add-concept'));
    (listOntologies as jest.Mock).mockResolvedValue({
      data: [
        {
          ...nativeOntology,
          publicationStatus: { active: RELEASED, unpublishedChanges: 1 },
        },
      ],
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
    expect(screen.getByText('2 label.isolated')).toBeVisible();
  });

  it('counts nothing in the header when an editor views a release that does not exist yet', async () => {
    useEnUsTranslations();
    try {
      renderNativeStudio('?ontology=native-sales', {
        ...nativeOntology,
        publicationStatus: { unpublishedChanges: 3 },
      });
      await screen.findByTestId('native-canvas');

      expect(screen.getByTestId('ontology-explorer-stats')).toHaveTextContent(
        '2 concepts · 0 relations'
      );

      fireEvent.click(screen.getByTestId('ontology-version-published'));
      await screen.findByTestId('ontology-nothing-published');

      expect(screen.getByTestId('ontology-explorer-stats')).toHaveTextContent(
        '0 concepts · 0 relations'
      );
    } finally {
      useKeyEchoTranslations();
    }
  });

  it('opens the draft after an import applied from the published view', async () => {
    renderNativeStudio('?ontology=native-sales&version=published');
    await screen.findByTestId('native-canvas');
    const menuProps = (
      jest.requireMock(
        '../../components/OntologyExplorer/OntologyImportExportMenu'
      ).default as jest.Mock
    ).mock.calls.at(-1)?.[0];

    act(() => menuProps?.onApplied());

    await waitFor(() =>
      expect(screen.getByTestId('location')).not.toHaveTextContent('version')
    );
  });

  it('counts the native ontology in the header with the singular and plural forms', async () => {
    useEnUsTranslations();
    renderNativeStudio('?ontology=native-sales');

    await screen.findByTestId('native-canvas');

    expect(screen.getByTestId('ontology-explorer-stats')).toHaveTextContent(
      '2 concepts · 0 relations'
    );

    useKeyEchoTranslations();
  });

  it('keeps the surface when switching to Edit and starts concept authoring from the shared header', async () => {
    renderNativeStudio('?ontology=native-sales');

    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('submode-tab-tree'));

    expect(screen.getByTestId('ontology-tree-view')).toBeVisible();

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    // Edit opens on the Tree the user was on, not back on the Graph.
    expect(screen.getByTestId('ontology-tree-view')).toBeVisible();

    fireEvent.click(screen.getByTestId('submode-tab-graph'));

    expect(screen.getByTestId('native-canvas')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-model-concept')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-add-concept'));

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();
  });

  it('offers the sub-tab Add concept to a user who holds all three class-creation rights', async () => {
    renderNativeStudio('?ontology=native-sales');
    await screen.findByTestId('native-canvas');

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(screen.getByTestId('ontology-add-concept')).toBeVisible();
  });

  it.each([
    ['author', true, ['view', 'edit', 'query'], true],
    ['reviewer', false, ['view', 'query'], false],
    ['consumer', false, ['view', 'query'], false],
  ])(
    'offers the %s the matching tabs and Publish trigger',
    async (_role, canEditAll, tabs, hasPublish) => {
      (useEntityPermissions as jest.Mock).mockReturnValue({ canEditAll });
      mockUseAuth.mockReturnValue({
        isAdminUser: false,
        isFirstTimeUser: false,
      });
      renderNativeStudio('?ontology=native-sales');
      await screen.findByTestId('native-canvas');

      expect(
        ['view', 'edit', 'query'].filter((id) =>
          screen.queryByTestId(`mode-tab-${id}`)
        )
      ).toEqual(tabs);
      expect(
        Boolean(screen.queryByTestId('ontology-publication-trigger'))
      ).toBe(hasPublish);
    }
  );

  it('hides the sub-tab Add concept from a user who cannot edit the ontology', async () => {
    (useEntityPermissions as jest.Mock).mockReturnValue({ canEditAll: false });
    renderNativeStudio('?ontology=native-sales');
    await screen.findByTestId('native-canvas');

    expect(screen.queryByTestId('mode-tab-edit')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-add-concept')
    ).not.toBeInTheDocument();
  });

  it('hides the sub-tab Add concept from a user who cannot create a change set', async () => {
    renderNativeStudio('?ontology=native-sales', nativeOntology, {
      ontologyConcept: { Create: true },
      ontologyChangeSet: { Create: false },
      ontologyProperty: { Create: true },
      ontologyAxiom: { Create: true },
    });
    await screen.findByTestId('native-canvas');

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(
      screen.queryByTestId('ontology-add-concept')
    ).not.toBeInTheDocument();
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

  describe('concept owner without ontology rights', () => {
    const asConceptOwner = (conceptId?: string) => {
      (useEntityPermissions as jest.Mock).mockImplementation(
        (resource, identifier, options) => ({
          canEditAll: [
            resource === 'ontologyConcept',
            options?.enabled !== false,
            Boolean(identifier?.id),
            !conceptId || identifier.id === conceptId,
          ].every(Boolean),
          isLoading: false,
        })
      );
      mockUseAuth.mockReturnValue({
        isAdminUser: false,
        isFirstTimeUser: false,
      });
    };
    const openCustomer = async () => {
      fireEvent.click(await screen.findByTestId('submode-tab-tree'));
      fireEvent.click(await screen.findByTestId('ontology-tree-term-Customer'));
    };

    it('reads the release, then enters Edit on the draft concept from the concept panel', async () => {
      asConceptOwner();
      (getOntologyConcept as jest.Mock).mockResolvedValue({
        id: 'Customer',
        name: 'Customer',
        fullyQualifiedName: 'native-sales.Customer',
        iri: 'https://example.org/sales#Customer',
        displayName: 'Customer as drafted',
      });
      renderNativeStudio('?ontology=native-sales');
      await screen.findByTestId('native-canvas');

      expect(screen.queryByTestId('mode-tab-edit')).not.toBeInTheDocument();

      await openCustomer();

      expect(await screen.findByText('Customer as released')).toBeVisible();

      fireEvent.click(screen.getByTestId('ontology-concept-edit'));

      expect(
        await screen.findByTestId('ontology-concept-editor')
      ).toBeVisible();
      expect(screen.getByText('Customer as drafted')).toBeVisible();
      expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByTestId('location')).toHaveTextContent('mode=edit');
      expect(screen.getByTestId('location')).not.toHaveTextContent('version');
    });

    it('keeps Edit when the URL selects a concept the user owns', async () => {
      asConceptOwner('Customer');
      renderNativeStudio('?ontology=native-sales&mode=edit&concept=Customer');

      await screen.findByTestId('native-canvas');

      expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByTestId('location')).toHaveTextContent('mode=edit');
    });

    it('stays in Edit after the library is opened and closed', async () => {
      asConceptOwner('Customer');
      renderNativeStudio('?ontology=native-sales&mode=edit&concept=Customer');
      await screen.findByTestId('native-canvas');

      fireEvent.click(screen.getByTestId('ontology-library-trigger'));
      fireEvent.click(screen.getByRole('button', { name: 'Close library' }));

      expect(screen.queryByTestId('ontology-library')).not.toBeInTheDocument();
      expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByTestId('location')).toHaveTextContent('mode=edit');
      expect(screen.getByTestId('location')).toHaveTextContent(
        'concept=Customer'
      );
    });

    it('returns a concept owner to View when the concept is deselected in Edit', async () => {
      asConceptOwner('Customer');
      renderNativeStudio('?ontology=native-sales&mode=edit&concept=Customer');
      await screen.findByTestId('native-canvas');

      expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
        'aria-selected',
        'true'
      );

      fireEvent.click(screen.getByTestId('deselect-concept'));

      await waitFor(() =>
        expect(screen.getByTestId('mode-tab-view')).toHaveAttribute(
          'aria-selected',
          'true'
        )
      );

      expect(screen.getByTestId('location')).not.toHaveTextContent('mode=edit');
    });

    it('keeps mode=edit from the URL while permissions load, then enters Edit once they allow it', async () => {
      const grants: Array<() => void> = [];
      (useEntityPermissions as jest.Mock).mockImplementation(() => {
        const [granted, setGranted] = useState(false);
        useEffect(() => {
          grants.push(() => setGranted(true));
        }, []);

        return { canEditAll: granted, isLoading: !granted };
      });
      mockUseAuth.mockReturnValue({
        isAdminUser: false,
        isFirstTimeUser: false,
      });
      renderNativeStudio('?ontology=native-sales&mode=edit&concept=Customer');

      await waitFor(() => expect(grants.length).toBeGreaterThan(0));
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId('location')).toHaveTextContent('mode=edit');

      await act(async () => {
        grants.forEach((grant) => grant());
      });

      await waitFor(() =>
        expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
          'aria-selected',
          'true'
        )
      );

      expect(screen.getByTestId('location')).toHaveTextContent('mode=edit');
    });

    it('falls back to View when mode=edit selects no concept', async () => {
      asConceptOwner();
      renderNativeStudio('?ontology=native-sales&mode=edit');

      await waitFor(() =>
        expect(screen.getByTestId('mode-tab-view')).toHaveAttribute(
          'aria-selected',
          'true'
        )
      );

      expect(screen.getByTestId('location')).not.toHaveTextContent('mode=edit');
    });
  });

  it('lands a user with no edit rights in View when the URL asks for mode=edit', async () => {
    (useEntityPermissions as jest.Mock).mockReturnValue({
      canEditAll: false,
      isLoading: false,
    });
    mockUseAuth.mockReturnValue({ isAdminUser: false, isFirstTimeUser: false });
    renderNativeStudio('?ontology=native-sales&mode=edit&concept=any');

    await waitFor(() =>
      expect(screen.getByTestId('mode-tab-view')).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );

    expect(screen.getByTestId('location')).not.toHaveTextContent('mode=edit');
  });

  describe('published version and URL state', () => {
    const asConsumer = () => {
      (useEntityPermissions as jest.Mock).mockReturnValue({
        canEditAll: false,
        isLoading: false,
      });
      mockUseAuth.mockReturnValue({
        isAdminUser: false,
        isFirstTimeUser: false,
      });
    };
    const openConcept = async (name: string) => {
      fireEvent.click(await screen.findByTestId('submode-tab-tree'));
      fireEvent.click(await screen.findByTestId(`ontology-tree-term-${name}`));
    };

    it('shows a user without edit rights the released wording while the draft has newer wording', async () => {
      asConsumer();
      renderNativeStudio('?ontology=native-sales');
      await openConcept('Customer');

      expect(await screen.findByText('Customer as released')).toBeVisible();
      expect(
        screen.queryByText('Customer working draft')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('ontology-version-switch')
      ).not.toBeInTheDocument();
    });

    it('tells a user without edit rights that nothing is published when no release is active', async () => {
      asConsumer();
      renderNativeStudio('?ontology=native-sales', {
        ...nativeOntology,
        publicationStatus: { unpublishedChanges: 3 },
      });

      expect(
        await screen.findByTestId('ontology-nothing-published')
      ).toHaveTextContent('message.ontology-nothing-published');
      expect(screen.queryByTestId('native-canvas')).not.toBeInTheDocument();
    });

    it('lets an editor switch between the draft and the published release', async () => {
      renderNativeStudio('?ontology=native-sales');
      await openConcept('Customer');

      expect(await screen.findByText('Customer working draft')).toBeVisible();
      expect(screen.getByTestId('mode-tab-edit')).toBeVisible();

      fireEvent.click(screen.getByTestId('ontology-version-published'));

      expect(await screen.findByText('Customer as released')).toBeVisible();
      expect(screen.getByTestId('location')).toHaveTextContent(
        'version=published'
      );
      expect(screen.queryByTestId('mode-tab-edit')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('ontology-version-draft'));

      expect(await screen.findByText('Customer working draft')).toBeVisible();
      expect(screen.getByTestId('location')).not.toHaveTextContent('version');
      expect(screen.getByTestId('mode-tab-edit')).toBeVisible();
    });

    it('leaves Edit when an editor switches to the published release', async () => {
      renderNativeStudio('?ontology=native-sales&mode=edit');
      await screen.findByTestId('native-canvas');

      expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
        'aria-selected',
        'true'
      );

      fireEvent.click(screen.getByTestId('ontology-version-published'));

      await waitFor(() =>
        expect(screen.getByTestId('mode-tab-view')).toHaveAttribute(
          'aria-selected',
          'true'
        )
      );

      expect(screen.getByTestId('location')).not.toHaveTextContent('mode=edit');
    });

    it.each([
      ['Edit', '?ontology=native-sales&mode=edit', 'mode-tab-edit', undefined],
      [
        'Edit Tree',
        '?ontology=native-sales&mode=edit&view=tree',
        'mode-tab-edit',
        'submode-tab-tree',
      ],
      [
        'View Tree',
        '?ontology=native-sales&view=tree',
        'mode-tab-view',
        'submode-tab-tree',
      ],
      [
        'Query',
        '?ontology=native-sales&mode=query',
        'mode-tab-query',
        undefined,
      ],
    ])(
      'reloading on %s returns to the same mode and view',
      async (_name, search, modeTab, viewTab) => {
        renderNativeStudio(search);

        await waitFor(() =>
          expect(screen.getByTestId(modeTab)).toHaveAttribute(
            'aria-selected',
            'true'
          )
        );
        if (viewTab) {
          expect(screen.getByTestId(viewTab)).toHaveAttribute(
            'aria-selected',
            'true'
          );
        }

        expect(screen.getByTestId('location')).toHaveTextContent(
          search.slice(1)
        );
      }
    );

    it.each([
      ['the graph', '?ontology=native-sales', true],
      ['the tree', '?ontology=native-sales&view=tree', false],
    ])(
      'offers full screen only on the graph: %s',
      async (_name, search, offered) => {
        renderNativeStudio(search);

        await screen.findByTestId('ontology-canvas-toolbar');

        expect(Boolean(screen.queryByTestId('ontology-full-screen'))).toBe(
          offered
        );
      }
    );

    it('pushes a history entry for a view change and Back returns to the previous view', async () => {
      renderNativeStudio('?ontology=native-sales');
      await screen.findByTestId('native-canvas');

      fireEvent.click(screen.getByTestId('submode-tab-tree'));
      fireEvent.click(screen.getByTestId('mode-tab-edit'));
      fireEvent.click(screen.getByTestId('mode-tab-query'));

      expect(screen.getByTestId('location')).toHaveTextContent(
        '?ontology=native-sales&mode=query'
      );

      fireEvent.click(screen.getByTestId('history-back'));
      await waitFor(() =>
        expect(screen.getByTestId('mode-tab-edit')).toHaveAttribute(
          'aria-selected',
          'true'
        )
      );

      fireEvent.click(screen.getByTestId('history-back'));
      await waitFor(() =>
        expect(screen.getByTestId('submode-tab-tree')).toHaveAttribute(
          'aria-selected',
          'true'
        )
      );

      expect(screen.getByTestId('mode-tab-view')).toHaveAttribute(
        'aria-selected',
        'true'
      );

      fireEvent.click(screen.getByTestId('history-back'));
      await waitFor(() =>
        expect(screen.getByTestId('submode-tab-graph')).toHaveAttribute(
          'aria-selected',
          'true'
        )
      );

      expect(screen.getByTestId('location')).toHaveTextContent(
        '?ontology=native-sales'
      );
    });

    it('replaces the entry when a concept is selected inside a view', async () => {
      renderNativeStudio('?ontology=native-sales');
      await screen.findByTestId('native-canvas');
      fireEvent.click(screen.getByTestId('submode-tab-tree'));
      fireEvent.click(await screen.findByTestId('ontology-tree-term-Customer'));

      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent('concept=')
      );

      fireEvent.click(screen.getByTestId('history-back'));

      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent(
          /^\?ontology=native-sales$/
        )
      );
    });

    it('opens the read-only Overview for a user without edit rights from the Ontology view', async () => {
      asConsumer();
      renderNativeStudio('?ontology=native-sales&view=ontology');

      const overview = await screen.findByTestId('ontology-overview');

      expect(overview).toHaveTextContent('urn:NativeSales:');
      expect(overview).toHaveTextContent('v1.0.0');
      expect(
        await screen.findByTestId('ontology-overview-count-concepts')
      ).toHaveTextContent('2');
      expect(screen.getByTestId('mode-tab-view')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(
        screen.getByRole('tab', { name: 'label.constraint-plural' })
      ).toBeInTheDocument();
    });

    it('says the ontology was not found for an unknown ontology id', async () => {
      renderNativeStudio('?ontology=does-not-exist');

      expect(await screen.findByTestId('ontology-not-found')).toHaveTextContent(
        'message.ontology-not-found'
      );
    });
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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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

    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('mode-tab-query'));

    expect(
      screen.getByTestId('ontology-rdf-disabled-notice')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('sparql-query-console')
    ).not.toBeInTheDocument();
  });

  it('renders the graph with edit mode enabled when Edit is selected', () => {
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('submode-tab-tree'));

    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({ isEditMode: false, surface: 'tree' })
    );
  });

  it('keeps glossary editing on the relations graph without ontology modeling', () => {
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(screen.getByTestId('submode-tab-graph')).toBeInTheDocument();
    expect(screen.queryByTestId('submode-tab-model')).not.toBeInTheDocument();
    expect(screen.queryByTestId('submode-tab-term')).not.toBeInTheDocument();
    expect(screen.queryByTestId('submode-tab-bulk')).not.toBeInTheDocument();
  });

  it('starts an inline concept draft without selecting a glossary first', () => {
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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
    expect(screen.getByTestId('ontology-add-concept-reason')).toHaveTextContent(
      'message.ontology-finish-open-concept-first'
    );
    expect(addConceptButton).toHaveAccessibleDescription(
      'message.ontology-finish-open-concept-first'
    );

    act(() => draftExplorerProps?.onConceptDraftClose?.());

    expect(screen.getByTestId('ontology-add-concept')).toBeEnabled();
    expect(
      screen.queryByTestId('ontology-add-concept-reason')
    ).not.toBeInTheDocument();
  });

  it('prefills the inline draft with the selected Edit graph glossary', () => {
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('mode-tab-query'));
    fireEvent.click(screen.getByTestId('submode-tab-builder'));

    expect(screen.getByTestId('visual-query-builder')).toBeInTheDocument();
    expect(
      screen.queryByTestId('sparql-query-console')
    ).not.toBeInTheDocument();
  });

  it('returns to the graph when View mode is reselected', () => {
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );
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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('mode-tab-library')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-library-trigger'));

    expect(screen.getByTestId('ontology-library')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close library' }));

    expect(screen.queryByTestId('ontology-library')).not.toBeInTheDocument();
  });

  it('refreshes the explorer and selects a glossary opened from the library', () => {
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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

    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('mode-tab-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mode-tab-review')).not.toBeInTheDocument();
    expect(screen.getByTestId('mode-tab-view')).toBeVisible();
    expect(screen.getByTestId('mode-tab-query')).toBeVisible();
  });

  describe('glossary Edit tab', () => {
    const renderGlossaryStudio = (permissions: Record<string, object>) => {
      mockUseAuth.mockReturnValue({
        isAdminUser: false,
        isFirstTimeUser: false,
      });
      (usePermissionProvider as jest.Mock).mockReturnValue({ permissions });
      render(
        <MemoryRouter>
          <OntologyExplorerPage />
        </MemoryRouter>
      );
    };

    afterEach(() => {
      (usePermissionProvider as jest.Mock).mockReturnValue({ permissions: {} });
    });

    it.each([
      [
        'EditGlossaryTerms on glossaries',
        { glossary: { EditGlossaryTerms: true } },
      ],
      [
        'EditEntityRelationship on glossary terms',
        { glossaryTerm: { EditEntityRelationship: true } },
      ],
    ])(
      'hides Edit from a steward with only %s, because the authoring lease needs EditAll',
      (_label, permissions) => {
        renderGlossaryStudio(permissions);

        expect(screen.queryByTestId('mode-tab-edit')).not.toBeInTheDocument();
        expect(screen.getByTestId('mode-tab-view')).toBeVisible();
      }
    );

    it('offers Edit to a user with EditAll on glossaries', () => {
      renderGlossaryStudio({ glossary: { EditAll: true } });

      expect(screen.getByTestId('mode-tab-edit')).toBeVisible();
    });

    it('leaves the native Edit tab to the ontology permission, not the glossary one', async () => {
      mockUseAuth.mockReturnValue({
        isAdminUser: false,
        isFirstTimeUser: false,
      });
      (useEntityPermissions as jest.Mock).mockReturnValue({ canEditAll: true });
      renderNativeStudio('?ontology=native-sales', nativeOntology, {});
      await screen.findByTestId('native-canvas');

      expect(screen.getByTestId('mode-tab-edit')).toBeVisible();
    });
  });

  it('lets a user approve AI proposals only with edit rights on glossaries and change sets', () => {
    mockUseAuth.mockReturnValue({ isAdminUser: false, isFirstTimeUser: false });
    const mockPermissions = usePermissionProvider as jest.Mock;
    mockPermissions.mockReturnValue({
      permissions: { glossary: { EditAll: true } },
    });

    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    expect(mockOntologyExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        proposalPermissions: { canApprove: true, canReject: true },
      })
    );

    mockPermissions.mockReturnValue({ permissions: {} });
  });

  it('hides the Needs review tab from the Studio mode bar', () => {
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('mode-tab-review')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-memory-review-panel')
    ).not.toBeInTheDocument();
  });

  it('still opens a linked draft in Studio review without a tab', () => {
    mockSearchParams = new URLSearchParams('draft=draft-16');

    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('ontology-memory-review-panel')).toBeVisible();
    expect(screen.queryByTestId('mode-tab-review')).not.toBeInTheDocument();

    mockSearchParams = new URLSearchParams('scope=glossary:all');
  });

  it('does not expose an AI affordance when the effective flag is disabled', () => {
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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

    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

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

    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('mode-tab-ai'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open generated query' })
    );

    expect(screen.getByTestId('sparql-query-console')).toBeInTheDocument();
    expect(mockQueryConsole).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialQuery: 'SELECT ?term WHERE {}' })
    );
  });

  it('opens the concept drawer from All ontologies Edit without a separate ontology select', async () => {
    renderNativeStudio('');
    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(
      screen.queryByRole('button', { name: /label.select-entity/ })
    ).not.toBeInTheDocument();

    fireEvent.click(await screen.findByTestId('ontology-add-concept'));

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();
  });

  describe('a concept link in an over-limit catalog', () => {
    const many = Array.from({ length: 21 }, (_, index) => ({
      ...nativeOntology,
      id: 'bulk-' + index,
      name: 'bulk' + index,
      fullyQualifiedName: 'bulk' + index,
    }));

    it('shows the linked concept inspector next to the capacity alert', async () => {
      (getOntologyConcept as jest.Mock).mockResolvedValue({
        id: 'Customer',
        name: 'Customer',
        iri: 'urn:Customer',
        ontology: { id: nativeOntology.id, type: 'ontology' },
      });
      renderNativeStudio(
        '?concept=Customer',
        nativeOntology,
        undefined,
        undefined,
        many
      );

      expect(
        await screen.findByText('message.ontology-aggregate-capacity')
      ).toBeVisible();
      expect(
        await screen.findByTestId('ontology-concept-inspector')
      ).toHaveTextContent('urn:Customer');
    });

    it('says the concept was not found for an unknown id', async () => {
      (getOntologyConcept as jest.Mock).mockRejectedValue(
        new AxiosError('missing', '404', undefined, undefined, {
          status: 404,
        } as AxiosResponse)
      );
      renderNativeStudio(
        '?concept=gone',
        nativeOntology,
        undefined,
        undefined,
        many
      );

      expect(
        await screen.findByText('message.ontology-concept-not-found')
      ).toBeVisible();
      expect(
        screen.queryByTestId('ontology-concept-inspector')
      ).not.toBeInTheDocument();
      expect(
        screen.getByText('message.ontology-aggregate-capacity')
      ).toBeVisible();
    });
  });

  it('still opens the concept drawer when All ontologies is over the aggregate limit', async () => {
    const many = Array.from({ length: 21 }, (_, index) => ({
      ...nativeOntology,
      id: 'bulk-' + index,
      name: 'bulk' + index,
      fullyQualifiedName: 'bulk' + index,
    }));
    renderNativeStudio('', nativeOntology, undefined, undefined, many);
    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(
      await screen.findByText('message.ontology-aggregate-capacity')
    ).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-add-concept'));

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();
  });

  it('selects an owner before mounting aggregate Query console', async () => {
    renderNativeStudio('');
    fireEvent.click(screen.getByTestId('mode-tab-query'));

    expect(
      screen.queryByTestId('sparql-query-console')
    ).not.toBeInTheDocument();

    expect(screen.getByTestId('ontology-query-picker-title')).toHaveTextContent(
      'message.query-choose-ontology-title'
    );

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.type(screen.getByRole('combobox'), 'Nat');
    await user.click(
      await screen.findByTestId(
        `ontology-query-picker-option-${nativeOntology.id}`
      )
    );
    await waitFor(() =>
      expect(mockQueryConsole).toHaveBeenLastCalledWith(
        expect.objectContaining({ selectedOntologyId: nativeOntology.id })
      )
    );
  });

  it('opens the ontology choice from the header New query on All ontologies', async () => {
    renderNativeStudio('');
    fireEvent.click(screen.getByTestId('mode-tab-query'));
    fireEvent.click(await screen.findByTestId('ontology-new-query'));

    expect(
      await screen.findByTestId(
        `ontology-query-picker-option-${nativeOntology.id}`
      )
    ).toBeVisible();
    expect(mockQueryConsole).not.toHaveBeenCalledWith(
      expect.objectContaining({ createQueryOnMount: true })
    );
  });

  it('queries the working draft for an editor and the active release once they switch', async () => {
    renderNativeStudio('?ontology=native-sales&mode=query');

    await waitFor(() =>
      expect(mockQueryConsole).toHaveBeenLastCalledWith(
        expect.objectContaining({
          queryScope: {
            ontologyName: 'Native sales',
            releaseVersion: '1.0.0',
            version: 'draft',
          },
        })
      )
    );

    fireEvent.click(screen.getByTestId('ontology-version-published'));

    await waitFor(() =>
      expect(mockQueryConsole).toHaveBeenLastCalledWith(
        expect.objectContaining({
          queryScope: {
            ontologyName: 'Native sales',
            releaseVersion: '1.0.0',
            version: 'published',
          },
        })
      )
    );
  });

  it('holds a user without edit rights to the active release even when the URL asks for the draft', async () => {
    (useEntityPermissions as jest.Mock).mockReturnValue({ canEditAll: false });
    renderNativeStudio('?ontology=native-sales&mode=query&version=draft');

    await waitFor(() =>
      expect(mockQueryConsole).toHaveBeenLastCalledWith(
        expect.objectContaining({
          queryScope: expect.objectContaining({ version: 'published' }),
        })
      )
    );

    expect(
      screen.queryByTestId('ontology-version-switch')
    ).not.toBeInTheDocument();
  });

  it('keeps a builder-generated query in its source scope only', async () => {
    renderNativeStudio('?scope=glossary:all');
    fireEvent.click(screen.getByTestId('mode-tab-query'));
    fireEvent.click(screen.getByTestId('submode-tab-builder'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit generated query' })
    );

    expect(mockQueryConsole).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialQuery: 'SELECT ?builder WHERE {}' })
    );

    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(await screen.findByTestId('ontology-scope-native-sales'));
    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('mode-tab-query'));

    expect(mockQueryConsole).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialQuery: undefined,
        selectedOntologyId: nativeOntology.id,
      })
    );
  });

  it('does not carry a legacy generated query into a native owner', async () => {
    mockUseOntologyAiCapability.mockReturnValue({
      isEnabled: true,
      isLoading: false,
      isRdfEnabled: true,
    });
    renderNativeStudio('?scope=glossary:all');
    fireEvent.click(screen.getByTestId('mode-tab-ai'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open generated query' })
    );

    expect(mockQueryConsole).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialQuery: 'SELECT ?term WHERE {}' })
    );

    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(await screen.findByTestId('ontology-scope-native-sales'));
    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('mode-tab-query'));

    expect(mockQueryConsole).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialQuery: undefined,
        selectedOntologyId: nativeOntology.id,
      })
    );
  });

  it.each(['?ontology=native-sales', ''])(
    'lists every linked asset in place from the Tree rail in %s',
    async (search) => {
      (getOntologyConceptBindings as jest.Mock).mockResolvedValue({
        revision: 0,
        assets: Array.from({ length: 7 }, (_, i) => ({
          assetId: 'asset-' + i,
          assetType: 'table',
          columns: [],
          asset: {
            id: 'asset-' + i,
            type: 'table',
            name: 'Asset ' + i,
            fullyQualifiedName: 'service.db.schema.asset' + i,
          },
        })),
      });
      renderNativeStudio(search);
      await screen.findByTestId('native-canvas');
      fireEvent.click(screen.getByTestId('submode-tab-tree'));
      fireEvent.click(await screen.findByTestId('ontology-tree-term-Customer'));
      const more = await screen.findByTestId('ontology-assets-more');

      expect(screen.queryByText('Asset 6')).not.toBeInTheDocument();

      fireEvent.click(more);

      expect(await screen.findByText('Asset 6')).toBeInTheDocument();
      expect(screen.getByTestId('submode-tab-tree')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(
        screen.getByTestId('ontology-concept-inspector')
      ).toHaveTextContent('Customer');
      expect(screen.getByTestId('location')).toHaveTextContent(
        'concept=Customer'
      );
    }
  );

  it('keeps Publish disabled on All ontologies even with a selected concept', async () => {
    renderNativeStudio('?concept=Customer&source=review');
    await screen.findByTestId('ontology-concept-inspector');
    fireEvent.click(screen.getByTestId('ontology-publication-trigger'));

    expect(screen.getByTestId('ontology-publication-trigger')).toBeDisabled();
    expect(
      screen.queryByTestId('ontology-publication-tab-changes')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      'concept=Customer'
    );
    expect(screen.getByTestId('location')).toHaveTextContent('source=review');
  });

  it("loads the data graph of the selected concept's ontology in the aggregate Data mode", async () => {
    (getNativeOntologyDataGraphPage as jest.Mock).mockResolvedValue(
      pageFixture({
        clusters: [
          {
            id: 'Customer',
            name: 'Customer',
            count: 1,
            assets: [{ id: 't1', name: 'customers' }],
          },
        ],
      })
    );
    const financeOntology: Ontology = {
      ...nativeOntology,
      id: 'native-finance',
      name: 'Native finance',
      fullyQualifiedName: 'NativeFinance',
      iri: 'urn:NativeFinance',
      namespace: 'urn:NativeFinance:',
    };
    renderNativeStudio(
      '?concept=Customer&source=review',
      nativeOntology,
      undefined,
      undefined,
      [financeOntology, nativeOntology]
    );
    await screen.findByTestId('ontology-concept-inspector');
    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));

    expect(
      await screen.findByTestId('ontology-data-cluster-Customer')
    ).toBeVisible();
    expect(getNativeOntologyDataGraphPage).toHaveBeenCalledTimes(1);
    expect(getNativeOntologyDataGraphPage).toHaveBeenCalledWith(
      'native-sales',
      { loaded: [], page: { kind: 'clusters', limit: 12, offset: 0 } },
      expect.any(AbortSignal)
    );
  });

  it('controls the aggregate viewport and clears selection while retaining its route context', async () => {
    renderNativeStudio('?source=review');
    await screen.findByTestId('native-canvas');
    fireEvent.click(screen.getByTestId('fit-view'));
    fireEvent.click(screen.getByTestId('zoom-in'));
    fireEvent.click(screen.getByTestId('zoom-out'));

    expect(mockCanvasControls.fitView).toHaveBeenCalled();
    expect(mockCanvasControls.zoomIn).toHaveBeenCalled();
    expect(mockCanvasControls.zoomOut).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Customer' }));
    fireEvent.click(screen.getByTestId('native-pane'));

    expect(
      screen.queryByTestId('ontology-concept-inspector')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('source=review');

    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));

    expect(
      screen.queryByTestId('ontology-native-data-graph')
    ).not.toBeInTheDocument();
    expect(screen.getByText('label.select-entity')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-graph-mode-model'));

    expect(screen.getByTestId('ontology-graph-mode-model')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('closes publication immediately when the active account changes', async () => {
    const { changeAccount } = renderNativeStudio(
      '?ontology=native-sales&source=review'
    );
    fireEvent.click(await screen.findByTestId('ontology-publication-trigger'));

    expect(screen.getByTestId('ontology-publication-modal')).toBeVisible();

    act(() => changeAccount('other-user'));

    expect(
      screen.queryByTestId('ontology-publication-modal')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('source=review');
  });

  it('refreshes server publication status when applying a native reviewed draft', async () => {
    mockUseRealScopes = true;
    renderNativeStudio('?ontology=native-sales&draft=draft-id');
    await screen.findByTestId('ontology-memory-review-panel');
    (listOntologies as jest.Mock).mockResolvedValue({
      data: [
        {
          ...nativeOntology,
          publicationStatus: { active: RELEASED, unpublishedChanges: 2 },
        },
      ],
      paging: { total: 1 },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply reviewed draft' })
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-publication-trigger')
      ).toHaveTextContent('(2)')
    );
  });
});
