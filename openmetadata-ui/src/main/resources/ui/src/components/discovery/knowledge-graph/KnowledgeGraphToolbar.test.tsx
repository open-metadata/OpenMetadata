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
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../../context/UntitledUIThemeProvider/theme-provider';
import { TreeSelect } from '@openmetadata/ui-core-components';
import type { GraphFilterOptions } from '../../../types/knowledgeGraph.types';
import KnowledgeGraphToolbar from './KnowledgeGraphToolbar';
import type { KnowledgeGraphToolbarProps } from './KnowledgeGraph.interface';

/**
 * The shared core `TreeSelect` caches its fetched tree for the lifetime of the
 * instance — `useTreeSelectData` only re-fetches on mount and on search-term
 * changes, never when the `fetchData` input would return different nodes. The
 * Knowledge Graph toolbar works around this by remounting the picker (via a
 * `key`) whenever the depth-scoped `filterOptions` change. jsdom cannot render
 * the react-aria popover the real component opens (see KnowledgeGraph.test.tsx),
 * so these tests stub `TreeSelect` with a mount-counting stand-in and assert the
 * remount contract directly: the picker must remount whenever the option
 * content (ids + counts) changes, including the non-empty → non-empty
 * replacement that a graph level change triggers.
 */
jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return { ...actual, TreeSelect: jest.fn(() => null) };
});

const mockedTreeSelect = TreeSelect as unknown as jest.Mock;

const mountCounts: Record<string, number> = {};
const lastProps: Record<string, Record<string, unknown>> = {};

/**
 * Mount-counting stand-in for the shared `TreeSelect`. jsdom cannot render the
 * react-aria popover the real component opens, so this stub records one mount
 * per `data-testid` (via an effect that runs once per instance) and the latest
 * props handed to each picker, then renders nothing.
 */
const TreeSelectMock = (props: Record<string, unknown>) => {
  const testId = props['data-testid'] as string;
  useEffect(() => {
    mountCounts[testId] = (mountCounts[testId] ?? 0) + 1;

    return () => {};
  }, [testId]);
  lastProps[testId] = props;

  return null;
};

const ENTITY = 'graph-entity-type-filter';
const RELATIONSHIP = 'graph-relationship-type-filter';

const entityOptions = (
  list: Array<{ id: string; label: string; count: number }>
) => list;

const relationshipOptions = (
  list: Array<{ id: string; label: string; count: number }>
) => list;

const baseProps = (
  overrides?: Partial<KnowledgeGraphToolbarProps>
): KnowledgeGraphToolbarProps => ({
  selectedLevel: 2,
  layout: 'dagre',
  labelMode: 'auto',
  mode: 'knowledge-graph',
  nodes: [],
  filters: { entityTypes: [], relationshipTypes: [] },
  filterOptions: undefined,
  presentation: 'balanced',
  showBands: false,
  ontology: { concepts: [], onChange: jest.fn() },
  viewport: { isFullscreen: false, onFullscreen: jest.fn() },
  onPresentationChange: jest.fn(),
  onToggleBands: jest.fn(),
  onFindNode: jest.fn(),
  onLevelChange: jest.fn(),
  onLayoutChange: jest.fn(),
  onLabelModeChange: jest.fn(),
  onModeChange: jest.fn(),
  onFiltersChange: jest.fn(),
  onExportJsonLd: jest.fn().mockResolvedValue(undefined),
  onExportPng: jest.fn().mockResolvedValue(undefined),
  onExportTurtle: jest.fn().mockResolvedValue(undefined),
  onExportCsv: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <MemoryRouter>{children}</MemoryRouter>
  </ThemeProvider>
);

const renderToolbar = (props: KnowledgeGraphToolbarProps) =>
  render(<KnowledgeGraphToolbar {...props} />, { wrapper: Wrapper });

const filterOptions = (
  entity: Array<{ id: string; label: string; count: number }>,
  relationship: Array<{ id: string; label: string; count: number }>
): GraphFilterOptions => ({
  entityTypes: entityOptions(entity),
  relationshipTypes: relationshipOptions(relationship),
});

describe('KnowledgeGraphToolbar type pickers', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    for (const key of Object.keys(mountCounts)) {
      delete mountCounts[key];
    }
    for (const key of Object.keys(lastProps)) {
      delete lastProps[key];
    }
    mockedTreeSelect.mockImplementation(TreeSelectMock);
  });

  it('remounts the Entity Type picker when option content changes while non-empty', () => {
    const props = baseProps();
    const { rerender } = renderToolbar({
      ...props,
      filterOptions: filterOptions(
        [{ id: 'table', label: 'Table', count: 2 }],
        [{ id: 'downstream', label: 'Downstream', count: 1 }]
      ),
    });

    expect(mountCounts[ENTITY]).toBe(1);

    // A graph level change replaces filterOptions in place (non-empty →
    // non-empty) — the bug scenario. The picker must remount.
    rerender(
      <KnowledgeGraphToolbar
        {...props}
        filterOptions={filterOptions(
          [
            { id: 'table', label: 'Table', count: 3 },
            { id: 'dashboard', label: 'Dashboard', count: 1 },
          ],
          [{ id: 'downstream', label: 'Downstream', count: 1 }]
        )}
      />
    );

    expect(mountCounts[ENTITY]).toBe(2);
    // Relationship options are unchanged, so that picker must NOT remount.
    expect(mountCounts[RELATIONSHIP]).toBe(1);
  });

  it('remounts the Relationship Type picker when its option content changes while non-empty', () => {
    const props = baseProps();
    const { rerender } = renderToolbar({
      ...props,
      filterOptions: filterOptions(
        [{ id: 'table', label: 'Table', count: 2 }],
        [
          { id: 'downstream', label: 'Downstream', count: 1 },
          { id: 'custom', label: 'Related to', count: 1 },
        ]
      ),
    });

    expect(mountCounts[RELATIONSHIP]).toBe(1);

    rerender(
      <KnowledgeGraphToolbar
        {...props}
        filterOptions={filterOptions(
          [{ id: 'table', label: 'Table', count: 2 }],
          [{ id: 'upstream', label: 'Upstream', count: 2 }]
        )}
      />
    );

    expect(mountCounts[RELATIONSHIP]).toBe(2);
    // Entity options unchanged → no remount.
    expect(mountCounts[ENTITY]).toBe(1);
  });

  it('does not remount when the option content is unchanged (new object, same ids and counts)', () => {
    const props = baseProps();
    const { rerender } = renderToolbar({
      ...props,
      filterOptions: filterOptions(
        [{ id: 'table', label: 'Table', count: 2 }],
        [{ id: 'downstream', label: 'Downstream', count: 1 }]
      ),
    });

    expect(mountCounts[ENTITY]).toBe(1);
    expect(mountCounts[RELATIONSHIP]).toBe(1);

    // A brand-new filterOptions object with identical id+count content must
    // produce the same signature and so must NOT remount either picker.
    rerender(
      <KnowledgeGraphToolbar
        {...props}
        filterOptions={filterOptions(
          [{ id: 'table', label: 'Table', count: 2 }],
          [{ id: 'downstream', label: 'Downstream', count: 1 }]
        )}
      />
    );

    expect(mountCounts[ENTITY]).toBe(1);
    expect(mountCounts[RELATIONSHIP]).toBe(1);
  });

  it('remounts when only the per-option counts change (same ids, different counts)', () => {
    const props = baseProps();
    const { rerender } = renderToolbar({
      ...props,
      filterOptions: filterOptions(
        [{ id: 'table', label: 'Table', count: 2 }],
        [{ id: 'downstream', label: 'Downstream', count: 1 }]
      ),
    });

    expect(mountCounts[ENTITY]).toBe(1);

    // A deeper level surfaces more nodes of the same type — the count rises
    // but no new type id appears. The stale picker would keep showing the old
    // count; the remount must fire on the count delta alone.
    rerender(
      <KnowledgeGraphToolbar
        {...props}
        filterOptions={filterOptions(
          [{ id: 'table', label: 'Table', count: 5 }],
          [{ id: 'downstream', label: 'Downstream', count: 1 }]
        )}
      />
    );

    expect(mountCounts[ENTITY]).toBe(2);
  });

  it('remounts when a previously available type is dropped at the new level', () => {
    const props = baseProps();
    const { rerender } = renderToolbar({
      ...props,
      filterOptions: filterOptions(
        [
          { id: 'table', label: 'Table', count: 2 },
          { id: 'dashboard', label: 'Dashboard', count: 1 },
        ],
        [{ id: 'downstream', label: 'Downstream', count: 1 }]
      ),
    });

    expect(mountCounts[ENTITY]).toBe(1);

    // A shallower level may surface fewer types; the dropped id changes the
    // signature and must trigger a remount so the stale leaf disappears.
    rerender(
      <KnowledgeGraphToolbar
        {...props}
        filterOptions={filterOptions(
          [{ id: 'table', label: 'Table', count: 2 }],
          [{ id: 'downstream', label: 'Downstream', count: 1 }]
        )}
      />
    );

    expect(mountCounts[ENTITY]).toBe(2);
  });

  it('remounts once when options arrive after an empty first paint', () => {
    const props = baseProps();
    const { rerender } = renderToolbar({ ...props, filterOptions: undefined });

    // Empty signature → both pickers mount once but disabled.
    expect(mountCounts[ENTITY]).toBe(1);
    expect(mountCounts[RELATIONSHIP]).toBe(1);
    expect(lastProps[ENTITY]?.disabled).toBe(true);
    expect(lastProps[RELATIONSHIP]?.disabled).toBe(true);

    // filterOptions arrive (async scene aggregation) — empty → non-empty must
    // remount so the picker fetches the real tree.
    rerender(
      <KnowledgeGraphToolbar
        {...props}
        filterOptions={filterOptions(
          [{ id: 'table', label: 'Table', count: 2 }],
          [{ id: 'downstream', label: 'Downstream', count: 1 }]
        )}
      />
    );

    expect(mountCounts[ENTITY]).toBe(2);
    expect(mountCounts[RELATIONSHIP]).toBe(2);
    expect(lastProps[ENTITY]?.disabled).toBe(false);
    expect(lastProps[RELATIONSHIP]?.disabled).toBe(false);
  });

  it('remounts across successive level changes (non-empty throughout)', () => {
    const props = baseProps();
    const { rerender } = renderToolbar({
      ...props,
      filterOptions: filterOptions(
        [{ id: 'table', label: 'Table', count: 2 }],
        [{ id: 'downstream', label: 'Downstream', count: 1 }]
      ),
    });

    expect(mountCounts[ENTITY]).toBe(1);

    rerender(
      <KnowledgeGraphToolbar
        {...props}
        filterOptions={filterOptions(
          [
            { id: 'table', label: 'Table', count: 3 },
            { id: 'dashboard', label: 'Dashboard', count: 1 },
          ],
          [
            { id: 'downstream', label: 'Downstream', count: 1 },
            { id: 'upstream', label: 'Upstream', count: 1 },
          ]
        )}
      />
    );

    expect(mountCounts[ENTITY]).toBe(2);
    expect(mountCounts[RELATIONSHIP]).toBe(2);

    // A third level — back to a single type but a different count than level 1.
    rerender(
      <KnowledgeGraphToolbar
        {...props}
        filterOptions={filterOptions(
          [{ id: 'table', label: 'Table', count: 4 }],
          [{ id: 'downstream', label: 'Downstream', count: 2 }]
        )}
      />
    );

    expect(mountCounts[ENTITY]).toBe(3);
    expect(mountCounts[RELATIONSHIP]).toBe(3);
  });
});
