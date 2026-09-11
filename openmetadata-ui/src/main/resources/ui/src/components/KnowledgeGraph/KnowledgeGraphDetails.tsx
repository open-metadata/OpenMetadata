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

import {
  Box,
  Button,
  Input,
  Select,
  Table,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import classNames from 'classnames';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Column } from '../../generated/entity/data/table';
import { getEntityNameLabel } from '../../utils/EntityNameUtils';
import Fqn from '../../utils/Fqn';
import { getGraphNodeHref } from '../../utils/knowledge-graph/knowledgeGraphNavigation.utils';
import { isCoverageNode } from '../../utils/knowledge-graph/knowledgeGraphPresentation.utils';
import { transformToG6Format } from '../../utils/KnowledgeGraph.utils';
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
  concepts: {
    terms: GlossaryTerm[];
    loading: boolean;
    error: unknown;
    partial: boolean;
  };
  coverage: Map<string, MappingCoverage>;
  coverageMode: string;
  relationshipScope?: { label: string; edgeIds: string[] } | null;
  onClearRelationshipScope?: () => void;
  onCoverageMode: (mode: 'all' | 'mapped' | 'unmapped' | 'highlight') => void;
  onDrawerChange: (drawer: KnowledgeGraphDrawer) => void;
  onSelect: (kind: 'node' | 'edge', id: string) => void;
  onClose: () => void;
  onRetry: () => void;
}

type CellTone = 'mono' | 'muted' | 'brand' | 'warning' | 'success';

interface DetailCell {
  text: string;
  tone?: CellTone;
  href?: string;
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
const COVERAGE_STATUSES: MappingCoverage[] = ['mapped', 'unmapped', 'unknown'];

const CELL_TONES: Record<CellTone, string> = {
  mono: 'tw:font-mono tw:text-primary',
  muted: 'tw:text-tertiary',
  brand: 'tw:text-brand-secondary',
  warning: 'tw:font-semibold tw:text-warning-primary',
  success: 'tw:text-success-primary',
};

const getColumnCoverage = (
  termCount: number,
  node: GraphNode | undefined,
  coverage: Map<string, MappingCoverage>
): MappingCoverage => {
  if (termCount > 0) {
    return 'mapped';
  }
  if (node) {
    return coverage.get(node.id) ?? 'unknown';
  }

  return 'unknown';
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
  concepts,
}: Pick<DetailsProps, 'drawer' | 'mode' | 'columns' | 'concepts'>) => {
  const metadata = mode === 'ontology' ? concepts : columns;

  return {
    loading: drawer === 'columns' && metadata.loading,
    error: drawer === 'columns' && metadata.error,
    showFilters: drawer !== 'columns' || mode !== 'ontology',
    hasMoreColumns:
      drawer === 'columns' &&
      mode !== 'ontology' &&
      columns.columns.length < columns.total,
    partial: mode === 'ontology' && concepts.partial,
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
    return { text: t('label.kg-no-glossary-term'), tone: 'warning' };
  }

  return { text: t('label.kg-unknown'), tone: 'muted' };
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
  const options =
    drawer === 'relationships'
      ? RELATION_CATEGORIES.map((family) => ({
          id: family as string,
          label: t(getRelationStyle(family).labelKey),
        }))
      : COVERAGE_STATUSES.map((status) => ({
          id: status as string,
          label: t('label.kg-' + status),
        }));
  const chips = options
    .map((chip) => ({
      ...chip,
      count: searched.filter((row) => row[facet] === chip.id).length,
    }))
    .filter((chip) => chip.count > 0);

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
  concepts,
  coverage,
  coverageMode,
  relationshipScope,
  onClearRelationshipScope,
  onCoverageMode,
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
  const hasGaps = [...coverage.values()].includes('unmapped');
  useEffect(() => {
    setSearch('');
    // The gaps list opens on the gaps themselves when there are any; the other
    // lists open on everything.
    setFilter(drawer === 'coverage' && hasGaps ? 'unmapped' : 'all');
    setLimit(PAGE_SIZE);
  }, [drawer, mode, relationshipScope, hasGaps]);
  const titles = {
    columns: t(DETAIL_LABELS[mode].columns),
    relationships: t(DETAIL_LABELS[mode].relationships),
    coverage: t(DETAIL_LABELS[mode].coverage),
  };
  const view = getDetailsState({ drawer, mode, columns, concepts });
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
              { text: nodeMap.get(edge.source)?.label ?? edge.source },
              { text: edge.data.label, tone: 'mono' },
              { text: nodeMap.get(edge.target)?.label ?? edge.target },
              {
                text: t(getRelationStyle(edge.data.category).labelKey),
                tone: 'muted',
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
        rows: data.nodes.filter(isCoverageNode).map((node) => {
          const status = coverage.get(node.id) ?? 'unknown';

          return {
            id: node.id,
            kind: 'node',
            target: node.id,
            coverage: status,
            cells: [
              { text: node.label, tone: 'mono' },
              { text: describeLocation(node), tone: 'muted' },
              coverageCell(status, t),
              status === 'unmapped' && getGraphNodeHref(node)
                ? {
                    text: t('label.kg-map-glossary-term'),
                    tone: 'brand',
                    href: getGraphNodeHref(node),
                  }
                : { text: '—', tone: 'muted' },
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
        rows: concepts.terms.flatMap((term) =>
          (term.effectiveAttributes ?? term.attributes ?? []).map(
            (attribute) => ({
              id: term.id + ':' + attribute.id,
              kind: 'node',
              target: nodeMap.get(
                attribute.iri ?? 'kg:property:' + term.id + ':' + attribute.id
              )?.id,
              cells: [
                { text: attribute.name, tone: 'mono' },
                {
                  text: attribute.datatypeIri ?? attribute.dataType,
                  tone: 'muted',
                },
                {
                  text:
                    attribute.declaringTerm?.displayName ??
                    attribute.declaringTerm?.name ??
                    term.displayName ??
                    term.name,
                  tone: 'brand',
                },
                {
                  text: attribute.isIdentifier
                    ? t('label.kg-at-most-one')
                    : t('label.kg-not-declared'),
                  tone: 'muted',
                },
              ],
            })
          )
        ),
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
        const termNames = terms
          .map((term) => term.displayName ?? term.name ?? term.tagFQN)
          .join(', ');

        return {
          id: column.fullyQualifiedName ?? column.name,
          kind: node ? 'node' : undefined,
          target: node?.id,
          coverage: mapping,
          cells: [
            { text: column.name, tone: 'mono' },
            { text: column.dataTypeDisplay ?? column.dataType, tone: 'muted' },
            termNames
              ? { text: termNames, tone: 'brand' }
              : { text: t('label.kg-' + mapping), tone: 'muted' },
            {
              text:
                (column.tags ?? [])
                  .filter((tag) => tag.source !== 'Glossary')
                  .map((tag) => tag.displayName ?? tag.name ?? tag.tagFQN)
                  .join(', ') || '—',
              tone: 'muted',
            },
          ],
        };
      }),
    };
  }, [
    drawer,
    mode,
    data,
    columns.columns,
    concepts.terms,
    coverage,
    t,
    relationshipScope,
  ]);
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
      className="kg-details tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary"
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
          <Box className="kg-details-tabs tw:shrink-0">
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
            color="secondary"
            iconLeading={XClose}
            size="sm"
            onPress={close}
          />
        </Box>
        <Tabs.Panel
          className="tw:flex tw:flex-col tw:flex-1 tw:min-h-0"
          id={drawer}>
          {view.showFilters && (
            <Box
              align="center"
              className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-3.5 tw:py-1.5"
              gap={2}
              wrap="wrap">
              {[
                { id: 'all', label: t('label.all'), count: searched.length },
                ...chips,
              ].map((chip) => (
                <Button
                  aria-pressed={filter === chip.id}
                  className="tw:rounded-full"
                  color={filter === chip.id ? 'secondary-brand' : 'secondary'}
                  key={chip.id}
                  size="xs"
                  onPress={() => {
                    setFilter(chip.id);
                    setLimit(PAGE_SIZE);
                  }}>
                  <Box align="center" gap={1}>
                    {chip.label}
                    <Typography
                      as="span"
                      className="tw:text-tertiary"
                      size="text-xs"
                      weight="semibold">
                      {chip.count}
                    </Typography>
                  </Box>
                </Button>
              ))}
              {drawer === 'coverage' && (
                <Select
                  aria-label={t('label.kg-show-on-canvas')}
                  className="tw:ml-auto tw:w-52 tw:max-w-full"
                  selectedKey={coverageMode}
                  size="sm"
                  onSelectionChange={(key) => {
                    if (
                      key === 'all' ||
                      key === 'mapped' ||
                      key === 'unmapped' ||
                      key === 'highlight'
                    ) {
                      onCoverageMode(key);
                    }
                  }}>
                  <Select.Item id="all" label={t('label.kg-every-entity')} />
                  <Select.Item
                    id="highlight"
                    label={t('label.kg-highlight-gaps')}
                  />
                  <Select.Item id="mapped" label={t('label.kg-mapped')} />
                  <Select.Item id="unmapped" label={t('label.kg-unmapped')} />
                </Select>
              )}
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
            className="tw:flex-1 tw:min-h-0 tw:overflow-auto"
            direction="col">
            <Table
              aria-label={titles[drawer]}
              className="kg-details-table"
              size="sm"
              onRowAction={(key) => {
                const row = model.rows.find((item) => item.id === key);
                if (row?.kind && row.target) {
                  onSelect(row.kind, row.target);
                }
              }}>
              <Table.Header>
                {model.headings.map((label, index) => (
                  <Table.Head
                    id={String(index)}
                    isRowHeader={index === 0}
                    key={label}
                    label={label}
                  />
                ))}
              </Table.Header>
              <Table.Body
                items={rows.slice(0, limit)}
                renderEmptyState={() =>
                  view.loading ? t('label.loading') : t('label.kg-no-results')
                }>
                {(row) => (
                  <Table.Row id={row.id}>
                    {row.cells.map((cell, index) => (
                      <Table.Cell
                        className={classNames(
                          'tw:py-1.5! tw:text-xs!',
                          cell.tone && CELL_TONES[cell.tone]
                        )}
                        key={model.headings[index]}>
                        {cell.href ? (
                          <Button
                            color="link-color"
                            href={cell.href}
                            rel="noopener noreferrer"
                            size="sm"
                            target="_blank">
                            {cell.text}
                          </Button>
                        ) : (
                          cell.text
                        )}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </Box>
          <Box
            align="center"
            className="tw:min-h-8 tw:shrink-0 tw:border-t tw:border-secondary tw:px-3.5 tw:py-1"
            gap={3}
            justify="between"
            wrap="wrap">
            <Typography
              aria-live="polite"
              className="tw:text-tertiary"
              size="text-xs">
              {t('label.kg-list-count', { count: rows.length })}
              {view.partial ? ' · ' + t('message.kg-partial-graph') : ''}
            </Typography>
            <Box align="center" gap={3}>
              {view.hasMoreColumns && (
                <Button
                  color="link-color"
                  isLoading={columns.loading}
                  size="sm"
                  onPress={columns.loadMore}>
                  {t('label.kg-load-columns', {
                    count: columns.total - columns.columns.length,
                  })}
                </Button>
              )}
              {rows.length > limit && (
                <Button
                  color="link-color"
                  size="sm"
                  onPress={() => setLimit(limit + PAGE_SIZE)}>
                  {t('label.kg-show-more', {
                    count: Math.min(PAGE_SIZE, rows.length - limit),
                    total: rows.length,
                  })}
                </Button>
              )}
            </Box>
          </Box>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
};

export default KnowledgeGraphDetails;
