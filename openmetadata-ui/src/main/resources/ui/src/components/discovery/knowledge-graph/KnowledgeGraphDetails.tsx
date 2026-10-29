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

import type { BadgeColors } from '@openmetadata/ui-core-components';
import {
  Badge,
  Box,
  Button,
  Input,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Column } from '../../../generated/entity/data/table';
import { TagLabel } from '../../../generated/type/tagLabel';
import { transformToG6Format } from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import { getGraphNodeHref } from '../../../utils/discovery/knowledge-graph/knowledgeGraphNavigation.utils';
import { isCoverageNode } from '../../../utils/discovery/knowledge-graph/knowledgeGraphPresentation.utils';
import { getEntityNameLabel } from '../../../utils/EntityNameUtils';
import Fqn from '../../../utils/Fqn';
import { ColumnsType } from '../../common/Table/Table.interface';
import Table from '../../common/Table/TableV2';
import TagsViewer from '../../Tag/TagsViewer/TagsViewer';
import DataTypeBadge from '../database/DataTypeBadge/DataTypeBadge';
import {
  GraphData,
  GraphNode,
  KnowledgeGraphDrawer,
  KnowledgeGraphMode,
  MappingCoverage,
} from './KnowledgeGraph.interface';
import {
  getRelationStyle,
  RelationCategory,
  RELATION_CATEGORIES,
} from './KnowledgeGraph.relations';
import {
  CellTone,
  CELL_TONE_PROPS,
  CHIP_LIMIT,
  FAMILY_BADGE_COLORS,
} from './KnowledgeGraphDetails.constants';
import { getTagsText } from './KnowledgeGraphDetails.utils';
import KnowledgeGraphDetailsFooter from './KnowledgeGraphDetailsFooter';

interface DetailsProps {
  drawer: KnowledgeGraphDrawer;
  mode: KnowledgeGraphMode;
  data: GraphData;
  columns: {
    columns: Column[];
    total: number;
    loading: boolean;
    error: unknown;
    loadMore: () => void;
  };
  coverage: Map<string, MappingCoverage>;
  relationshipScope?: { label: string; edgeIds: string[] } | null;
  onClearRelationshipScope?: () => void;
  onDrawerChange: (drawer: KnowledgeGraphDrawer) => void;
  onSelect: (kind: 'node' | 'edge', id: string) => void;
  onClose: () => void;
  onRetry: () => void;
}

interface DetailCell {
  /** Plain text of the cell; also what the search box matches against. */
  text: string;
  tone?: CellTone;
  href?: string;
  /** Renders the text as a coloured badge. */
  badge?: BadgeColors;
  /** Renders a column data-type badge; `text` is the display form. */
  dataType?: string;
  /** Renders tag / glossary-term chips (TagsViewer) instead of the text. */
  tags?: TagLabel[];
}

interface DetailRow {
  id: string;
  cells: DetailCell[];
  kind?: 'node' | 'edge';
  target?: string;
  family?: RelationCategory;
  coverage?: MappingCoverage;
}

/** Rows revealed per "Show more", matching the design's paging of the list. */
const PAGE_SIZE = 40;
const UNKNOWN: MappingCoverage = 'unknown';
const COVERAGE_STATUSES: MappingCoverage[] = ['mapped', 'unmapped', UNKNOWN];
/** Gaps surfaces only the actionable statuses — mapped rows aren't a gap. */
const GAPS_STATUSES: MappingCoverage[] = ['unmapped', UNKNOWN];

const getColumnCoverage = (
  termCount: number,
  node: GraphNode | undefined,
  coverage: Map<string, MappingCoverage>
): MappingCoverage => {
  if (termCount > 0) {
    return 'mapped';
  }
  if (node) {
    return coverage.get(node.id) ?? UNKNOWN;
  }

  return UNKNOWN;
};

const DETAIL_LABELS = {
  'knowledge-graph': {
    columns: 'label.column-plural',
    relationships: 'label.relationship-plural',
    coverage: 'label.kg-gaps',
  },
  ontology: {
    columns: 'label.property-plural',
    relationships: 'label.kg-axioms',
    coverage: 'label.kg-coverage',
  },
};

const getDetailsState = ({
  drawer,
  mode,
  columns,
}: Pick<DetailsProps, 'drawer' | 'mode' | 'columns'>) => {
  return {
    loading: drawer === 'columns' && mode !== 'ontology' && columns.loading,
    error: drawer === 'columns' && mode !== 'ontology' && columns.error,
    showFilters: drawer !== 'columns' || mode !== 'ontology',
    hasMoreColumns:
      drawer === 'columns' &&
      mode !== 'ontology' &&
      columns.columns.length < columns.total,
  };
};

const coverageCell = (
  status: MappingCoverage,
  t: (key: string) => string
): DetailCell => {
  if (status === 'mapped') {
    return { text: t('label.kg-mapped'), tone: 'success' };
  }
  if (status === 'unmapped') {
    // Name the actual missing thing per the designer's review — the row is
    // in Gaps because this field is empty, so the cell says what to add.
    return { text: t('label.kg-missing-glossary-term'), tone: 'warning' };
  }

  // "unknown" means the node sits outside the current traversal depth.
  // Name that explicitly so the user understands the row needs level-bumping,
  // not a mapping action.
  return { text: t('label.kg-outside-current-level'), tone: 'muted' };
};

/**
 * Suggested fix per coverage status — the real editors (glossary-term picker,
 * owner picker, etc.) already live on the asset page, so we just route the
 * user there with the right action label. Owner-missing isn't a client-known
 * signal yet; when backend coverage surfaces it we'll add an "Assign owner"
 * branch here.
 */
const suggestedFixCell = (
  status: MappingCoverage,
  node: GraphNode,
  t: (key: string) => string
): DetailCell => {
  const href = getGraphNodeHref(node);
  if (status === 'unmapped' && href) {
    return { text: t('label.kg-map-glossary-term'), tone: 'brand', href };
  }
  if (status === UNKNOWN) {
    // Not-explored stubs don't always have a fullyQualifiedName (they're
    // placeholder rows for assets outside the current depth), so we may not
    // have an asset page to link to. Show the hint as muted text — the
    // Missing cell already says "Outside current level" and the user bumps
    // the Levels dropdown to reveal them.
    return href
      ? { text: t('label.kg-explore'), tone: 'brand', href }
      : { text: t('label.kg-explore'), tone: 'muted' };
  }

  return { text: '—', tone: 'muted' };
};

/** Search narrows every list; the chips then split what is left by family or coverage. */
const filterRows = (
  rows: DetailRow[],
  drawer: KnowledgeGraphDrawer,
  search: string,
  filter: string,
  t: (key: string) => string
) => {
  const searched = rows.filter((row) =>
    row.cells
      .map((cell) => cell.text)
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const facet = drawer === 'relationships' ? 'family' : 'coverage';
  const coverageOptions =
    drawer === 'coverage' ? GAPS_STATUSES : COVERAGE_STATUSES;
  const options =
    drawer === 'relationships'
      ? RELATION_CATEGORIES.map((family) => ({
          id: family as string,
          label: t(getRelationStyle(family).labelKey),
        }))
      : coverageOptions.map((status) => ({
          id: status as string,
          label: t('label.kg-' + status),
        }));
  const chips = options
    .map((chip) => ({
      ...chip,
      count: searched.filter((row) => row[facet] === chip.id).length,
    }))
    // Gaps always surfaces both Unmapped + Not explored so the user can see
    // the current filter even at count 0 (otherwise the "Unmapped 0" chip
    // disappears, the default filter has no visible pill, and the user cannot
    // tell why the table is empty). Other drawers keep the count>0 behaviour
    // so irrelevant family chips stay hidden.
    .filter((chip) => drawer === 'coverage' || chip.count > 0);

  return {
    searched,
    chips,
    rows:
      filter === 'all'
        ? searched
        : searched.filter((row) => row[facet] === filter),
  };
};

/** Where an asset lives, as the design's "Where" column: parent path · type. */
const describeLocation = (node: GraphNode) => {
  const path = node.fullyQualifiedName
    ? Fqn.split(node.fullyQualifiedName).slice(0, -1).join('.')
    : '';

  return [path, getEntityNameLabel(node.type)].filter(Boolean).join(' · ');
};

const KnowledgeGraphDetails = ({
  drawer,
  mode,
  data,
  columns,
  coverage,
  relationshipScope,
  onClearRelationshipScope,
  onDrawerChange,
  onSelect,
  onClose,
  onRetry,
}: DetailsProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    headingRef.current?.focus({ preventScroll: true });

    return () => {
      if (returnFocus.current?.isConnected) {
        returnFocus.current.focus({ preventScroll: true });
      }
    };
  }, []);
  useEffect(() => {
    setSearch('');
    // Every drawer opens on "All" — Gaps now surfaces one combined table
    // (unmapped + unknown) with the status visible in the Missing column.
    setFilter('all');
    setLimit(PAGE_SIZE);
  }, [drawer, mode, relationshipScope]);
  const titles = {
    columns: t(DETAIL_LABELS[mode].columns),
    relationships: t(DETAIL_LABELS[mode].relationships),
    coverage: t(DETAIL_LABELS[mode].coverage),
  };
  const view = getDetailsState({ drawer, mode, columns });
  const model = useMemo((): {
    headings: string[];
    rows: DetailRow[];
    hint: string;
  } => {
    const nodeMap = new Map(data.nodes.map((node) => [node.id, node]));
    if (drawer === 'relationships') {
      return {
        headings: [
          t('label.kg-subject'),
          t('label.kg-predicate'),
          t('label.kg-object'),
          t('label.kg-family'),
        ],
        hint: t('message.kg-relationship-list'),
        rows: transformToG6Format(data)
          .edges.filter(
            (edge) =>
              !relationshipScope ||
              relationshipScope.edgeIds.includes(String(edge.id))
          )
          .map((edge) => ({
            id: String(edge.id),
            kind: 'edge',
            target: String(edge.id),
            family: edge.data.category,
            cells: [
              {
                text: nodeMap.get(edge.source)?.label ?? edge.source,
                tone: 'primary',
              },
              { text: edge.data.label, tone: 'primary' },
              {
                text: nodeMap.get(edge.target)?.label ?? edge.target,
                tone: 'primary',
              },
              {
                text: t(getRelationStyle(edge.data.category).labelKey),
                badge: FAMILY_BADGE_COLORS[edge.data.category],
              },
            ],
          })),
      };
    }
    if (drawer === 'coverage') {
      return {
        headings: [
          t('label.asset'),
          t('label.kg-where'),
          t('label.kg-missing'),
          t('label.kg-suggested-fix'),
        ],
        hint: t('message.kg-coverage-scope'),
        // Gaps surfaces actionable rows only (unmapped) so the row count
        // matches the Gaps badge in the footer (also unmapped-only). "Not
        // explored" items aren't missing data — they sit outside the current
        // traversal depth and are seen by bumping the level, not from here.
        rows: data.nodes
          .filter(isCoverageNode)
          .filter((node) => coverage.get(node.id) === 'unmapped')
          .map((node) => {
            const status = coverage.get(node.id) ?? UNKNOWN;

            return {
              id: node.id,
              kind: 'node',
              target: node.id,
              coverage: status,
              cells: [
                { text: node.label, tone: 'primary' },
                { text: describeLocation(node), tone: 'muted' },
                coverageCell(status, t),
                suggestedFixCell(status, node, t),
              ],
            };
          }),
      };
    }
    if (mode === 'ontology') {
      return {
        headings: [
          t('label.property'),
          t('label.kg-range'),
          t('label.kg-domain-concept'),
          t('label.kg-cardinality'),
        ],
        hint: t('message.kg-properties-scope'),
        rows: data.nodes
          .filter((node) => node.type === 'property')
          .map((node) => ({
            id: node.id,
            kind: 'node',
            target: node.id,
            cells: [
              { text: node.label, tone: 'primary' },
              { text: node.ontologyProperty?.range ?? '', tone: 'muted' },
              {
                text: data.edges
                  .filter(
                    (edge) =>
                      edge.from === node.id &&
                      edge.relationType ===
                        'http://www.w3.org/2000/01/rdf-schema#domain'
                  )
                  .map((edge) => nodeMap.get(edge.to)?.label ?? '')
                  .join(', '),
                tone: 'brand',
              },
              {
                text: node.ontologyProperty?.functional
                  ? t('label.kg-at-most-one')
                  : t('label.kg-not-declared'),
                tone: 'muted',
              },
            ],
          })),
      };
    }
    const graphColumns = new Map(
      data.nodes
        .filter((node) => node.type.toLowerCase() === 'column')
        .map((node) => [node.fullyQualifiedName ?? node.label, node])
    );
    const flatten = (list: Column[]): Column[] =>
      list.flatMap((column) => [column, ...flatten(column.children ?? [])]);

    return {
      headings: [
        t('label.column'),
        t('label.type'),
        t('label.glossary-term-plural'),
        t('label.tag-plural'),
      ],
      hint: t('message.kg-columns-scope'),
      rows: flatten(columns.columns).map((column) => {
        const terms =
          column.tags?.filter((tag) => tag.source === 'Glossary') ?? [];
        const node = graphColumns.get(column.fullyQualifiedName ?? column.name);
        const mapping = getColumnCoverage(terms.length, node, coverage);
        const classificationTags = (column.tags ?? []).filter(
          (tag) => tag.source !== 'Glossary'
        );
        const dataType = column.dataTypeDisplay ?? column.dataType;

        return {
          id: column.fullyQualifiedName ?? column.name,
          kind: node ? 'node' : undefined,
          target: node?.id,
          coverage: mapping,
          cells: [
            { text: column.name, tone: 'primary' },
            { text: dataType, dataType: column.dataType },
            terms.length > 0
              ? { text: getTagsText(terms), tags: terms }
              : { text: t('label.kg-' + mapping), tone: 'muted' },
            classificationTags.length > 0
              ? {
                  text: getTagsText(classificationTags),
                  tags: classificationTags,
                }
              : { text: '—', tone: 'muted' },
          ],
        };
      }),
    };
  }, [drawer, mode, data, columns.columns, coverage, t, relationshipScope]);
  const tableLocale = useMemo(
    () => ({
      emptyText: view.loading ? t('label.loading') : t('label.kg-no-results'),
    }),
    [view.loading, t]
  );
  const getRowHandlers = useMemo(
    () => (record: DetailRow) => {
      const activate = () => {
        if (record.kind && record.target) {
          onSelect(record.kind, record.target);
        }
      };

      return {
        onClick: activate,
        // TableV2 wires onClick but routes keyboard activation to a no-op
        // onAction, so Enter/Space on a focused row would do nothing without
        // this. Match the old core Table's onRowAction keyboard behaviour.
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
          }
        },
      };
    },
    [onSelect]
  );
  const tableColumns = useMemo<ColumnsType<DetailRow>>(
    () =>
      model.headings.map((label, columnIndex) => ({
        key: label,
        title: label,
        render: (_: unknown, record: DetailRow) => {
          const cell = record.cells[columnIndex];
          if (!cell) {
            return null;
          }
          if (cell.tags) {
            return (
              <TagsViewer
                showNoDataPlaceholder={false}
                sizeCap={CHIP_LIMIT}
                tags={cell.tags}
              />
            );
          }
          if (cell.dataType) {
            return (
              <DataTypeBadge dataType={cell.dataType} displayName={cell.text} />
            );
          }
          if (cell.badge) {
            return (
              <Badge color={cell.badge} size="sm" type="color">
                {cell.text}
              </Badge>
            );
          }
          if (cell.href) {
            return (
              <Button
                color="link-color"
                href={cell.href}
                rel="noopener noreferrer"
                size="sm"
                target="_blank">
                {cell.text}
              </Button>
            );
          }

          return (
            <Typography
              size="text-sm"
              {...(cell.tone && CELL_TONE_PROPS[cell.tone])}>
              {cell.text}
            </Typography>
          );
        },
      })),
    [model.headings]
  );
  const { searched, rows, chips } = filterRows(
    model.rows,
    drawer,
    search,
    filter,
    t
  );
  const close = () => onClose();

  return (
    <Box
      aria-label={titles[drawer]}
      className="kg-details tw:shrink-0 tw:border-t tw:border-secondary tw:bg-surface"
      data-testid="graph-details"
      direction="col"
      role="region"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}>
      <Typography
        as="h3"
        className="tw:sr-only"
        ref={headingRef}
        size="text-sm"
        tabIndex={-1}>
        {titles[drawer]}
      </Typography>
      <Tabs
        className="tw:flex tw:flex-col tw:flex-1 tw:min-h-0"
        selectedKey={drawer}
        onSelectionChange={(key) => {
          if (
            key === 'columns' ||
            key === 'relationships' ||
            key === 'coverage'
          ) {
            onDrawerChange(key);
          }
        }}>
        <Box
          align="center"
          className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-3.5 tw:py-2"
          gap={3}
          wrap="wrap">
          <Box className="tw:shrink-0">
            <Tabs.List
              aria-label={t('label.kg-details')}
              size="sm"
              type="button-minimal">
              {(Object.keys(titles) as KnowledgeGraphDrawer[]).map((key) => (
                <Tabs.Item id={key} key={key} label={titles[key]} />
              ))}
            </Tabs.List>
          </Box>
          <Typography
            className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-tertiary"
            size="text-xs">
            {model.hint}
          </Typography>
          {drawer === 'relationships' && relationshipScope && (
            <Button
              className="tw:rounded-full"
              color="secondary"
              iconTrailing={XClose}
              size="xs"
              onPress={onClearRelationshipScope}>
              {relationshipScope.label}
            </Button>
          )}
          {drawer !== 'coverage' && (
            <Input
              aria-label={t('label.search')}
              className="tw:w-52 tw:max-w-full"
              placeholder={t('label.search')}
              size="sm"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setLimit(PAGE_SIZE);
              }}
            />
          )}
          <Button
            aria-label={t('label.close')}
            color="tertiary"
            iconLeading={XClose}
            size="sm"
            onPress={close}
          />
        </Box>
        <Tabs.Panel
          className="tw:flex tw:flex-col tw:flex-1 tw:min-h-0"
          id={drawer}>
          {view.showFilters && drawer !== 'coverage' && (
            <Box
              align="center"
              className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-3.5 tw:py-1"
              wrap="wrap">
              <Tabs
                // Tabs core doesn't ship an `xs` size, so trim the sm padding
                // and text size via class override to match the designer's
                // compact chip row (two-line drawer).
                className="tw:w-fit tw:[&_[role=tab]]:px-2 tw:[&_[role=tab]]:py-1 tw:[&_[role=tab]]:text-xs"
                selectedKey={filter}
                onSelectionChange={(key) => {
                  setFilter(String(key));
                  setLimit(PAGE_SIZE);
                }}>
                <Tabs.List size="sm" type="button-border">
                  <Tabs.Item badge={searched.length} id="all">
                    {t('label.all')}
                  </Tabs.Item>
                  {chips.map((chip) => (
                    <Tabs.Item badge={chip.count} id={chip.id} key={chip.id}>
                      {chip.label}
                    </Tabs.Item>
                  ))}
                </Tabs.List>
              </Tabs>
            </Box>
          )}
          {view.error ? (
            <Box align="center" className="tw:px-3.5 tw:py-2" gap={2}>
              <Typography role="alert" size="text-sm">
                {t('message.kg-load-error')}
              </Typography>
              <Button color="link-color" size="sm" onPress={onRetry}>
                {t('label.retry')}
              </Button>
            </Box>
          ) : null}
          <Box
            aria-busy={view.loading}
            className="tw:flex-1 tw:min-h-0"
            direction="col">
            <Table
              aria-label={titles[drawer]}
              className="kg-details-table"
              columns={tableColumns}
              // TableV2's root `.table-container` is `display: block` by default
              // so its inner `flex-1 min-h-0` chain can't bound against it
              // (block parent ignores flex child sizing). Making the root itself
              // the flex child + container lets the UntitledTable scroll
              // container's `max-height: 100%` resolve to the real bounded
              // height; `scroll.y` wires the overflowY on that container.
              containerClassName="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col"
              dataSource={rows.slice(0, limit)}
              loading={view.loading}
              locale={tableLocale}
              pagination={false}
              rowKey="id"
              scroll={{ y: '100%' }}
              size="small"
              onRow={getRowHandlers}
            />
          </Box>
          <KnowledgeGraphDetailsFooter
            isLoadingColumns={columns.loading}
            limit={limit}
            pageSize={PAGE_SIZE}
            total={rows.length}
            unloadedColumns={
              view.hasMoreColumns ? columns.total - columns.columns.length : 0
            }
            onLoadColumns={columns.loadMore}
            onShowMore={() => setLimit(limit + PAGE_SIZE)}
          />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
};

export default KnowledgeGraphDetails;
