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
/**
 * The lineage endpoints behind an entity's Lineage tab, answered from one
 * small graph. Lineage nodes are search-index documents, so a node carries the
 * index fields the filters query (`service.displayName`, `serviceType`,
 * `ownerDisplayName`, `tier.tagFQN`, ...), and `query_filter` /
 * `column_filter` are applied to them the way the server applies them: only
 * matching nodes come back and the per-depth counts count only those.
 */
import { http, HttpResponse } from 'msw';
import { AddLineage } from '../../../generated/api/lineage/addLineage';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { LineagePaginationInfo } from '../../../generated/api/lineage/lineagePaginationInfo';
import { Table } from '../../../generated/entity/data/table';
import { EdgeDetails } from '../../../interface/lineage.interface';
import { EMPTY_LIST, worker } from '../msw';
import { SCHEMA } from './hierarchy';

/** A lineage node as the search index stores it. */
export interface LineageDoc {
  id: string;
  type: string;
  name: string;
  displayName?: string;
  fullyQualifiedName: string;
  serviceType?: string;
  service?: { name: string; displayName?: string; type: string };
  domains?: Array<{ name: string; displayName: string; type: string }>;
  ownerDisplayName?: string[];
  tags?: Array<{ tagFQN: string }>;
  tier?: { tagFQN: string };
  database?: { name: string; displayName: string };
  databaseSchema?: { name: string; displayName: string };
  columns?: Array<{ name: string; fullyQualifiedName: string }>;
  /** A dashboard's charts, which its column lineage maps to. */
  charts?: Array<{
    id: string;
    type: string;
    name: string;
    fullyQualifiedName: string;
  }>;
}

export interface LineageNode {
  doc: LineageDoc;
  depth: number;
}

const ROOT_NAME = 'pw_lineage_root';

export const LINEAGE_ROOT: Table = {
  id: '00000000-0000-4000-8000-0000000000f0',
  name: ROOT_NAME,
  fullyQualifiedName: `${SCHEMA.fullyQualifiedName}.${ROOT_NAME}`,
  columns: [],
  databaseSchema: SCHEMA,
  database: SCHEMA.database,
  service: SCHEMA.service,
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
};

/** A table node under the shared schema; `n` keeps ids unique. */
export const lineageTable = (
  n: number,
  name: string,
  fields: Partial<LineageDoc> = {}
): LineageDoc => ({
  id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`,
  type: 'table',
  name,
  displayName: name,
  fullyQualifiedName: `${SCHEMA.fullyQualifiedName}.${name}`,
  serviceType: 'Mysql',
  service: {
    name: 'pw_mysql',
    displayName: 'pw_mysql',
    type: 'databaseService',
  },
  // A table's search document always lists its columns.
  columns: [],
  ...fields,
});

export const lineageImpactUrl = (
  query = 'dir=Downstream&depth=1&pageSize=15'
) =>
  `/table/${encodeURIComponent(
    LINEAGE_ROOT.fullyQualifiedName ?? ''
  )}/lineage?mode=impact_analysis&${query}`;

type Clause = {
  term?: Record<string, string>;
  wildcard?: Record<string, { value: string }>;
  bool?: { should?: Clause[]; must?: Clause[] | Clause };
};

/** Every value at a dotted path, flattening arrays on the way (as ES does). */
const valuesAt = (doc: unknown, path: string[]): string[] => {
  if (Array.isArray(doc)) {
    return doc.flatMap((item) => valuesAt(item, path));
  }
  if (path.length === 0) {
    return doc === undefined || doc === null ? [] : [String(doc)];
  }
  if (typeof doc !== 'object' || doc === null) {
    return [];
  }

  return valuesAt((doc as Record<string, unknown>)[path[0]], path.slice(1));
};

const fieldValues = (doc: LineageDoc, field: string) =>
  valuesAt(doc, field.replace(/\.keyword$/, '').split('.')).map((v) =>
    v.toLowerCase()
  );

// The keyword fields the filters use are lowercase-normalized in the index.
const matches = (doc: LineageDoc, clause: Clause): boolean => {
  if (clause.term) {
    const [[field, value]] = Object.entries(clause.term);

    return fieldValues(doc, field).includes(value.toLowerCase());
  }
  if (clause.wildcard) {
    const [[field, { value }]] = Object.entries(clause.wildcard);
    const part = value.replaceAll('*', '').toLowerCase();

    return fieldValues(doc, field).some((v) => v.includes(part));
  }
  if (clause.bool) {
    const must = [clause.bool.must ?? []].flat();
    const should = clause.bool.should ?? [];

    return (
      must.every((c) => matches(doc, c)) &&
      (should.length === 0 || should.some((c) => matches(doc, c)))
    );
  }

  throw new Error(
    `fixtures/lineage: unsupported clause ${JSON.stringify(clause)}`
  );
};

export const matchesQueryFilter = (
  doc: LineageDoc,
  queryFilter: string | null
) => !queryFilter || matches(doc, JSON.parse(queryFilter).query);

const depthInfo = (nodes: LineageNode[]) =>
  Object.entries(
    nodes.reduce<Record<number, number>>((acc, { depth }) => {
      acc[depth] = (acc[depth] ?? 0) + 1;

      return acc;
    }, {})
  ).map(([depth, entityCount]) => ({ depth: Number(depth), entityCount }));

/** Mirrors AbstractLineageGraphBuilder#buildPaginationInfo. */
const paginationInfo = (
  upstream: LineageNode[],
  downstream: LineageNode[]
): LineagePaginationInfo => ({
  upstreamDepthInfo: depthInfo(upstream),
  downstreamDepthInfo: depthInfo(downstream),
  maxUpstreamDepth: Math.max(0, ...upstream.map((n) => n.depth)),
  maxDownstreamDepth: Math.max(0, ...downstream.map((n) => n.depth)),
  totalUpstreamEntities: upstream.length,
  totalDownstreamEntities: downstream.length,
});

const rootDoc: LineageDoc = {
  id: LINEAGE_ROOT.id,
  type: 'table',
  name: ROOT_NAME,
  fullyQualifiedName: LINEAGE_ROOT.fullyQualifiedName ?? '',
};

const fqnOf = (ref: { fullyQualifiedName?: string }) =>
  ref.fullyQualifiedName ?? '';

/**
 * Only nodes an edge connects to the root come back. Mirrors
 * LineagePathPreserver#preservePathsWithEdges: with a filter, the
 * matching nodes come back with the root and every node on their path to it;
 * edges are kept only between nodes that are kept. Upstream nodes carry a
 * negative depth.
 */
const canvasLineage = (
  root: LineageDoc,
  nodes: LineageNode[],
  edges: EdgeDetails[],
  queryFilter: string | null
) => {
  const present = new Set([root, ...nodes.map(({ doc }) => doc)].map(fqnOf));
  const inGraph = edges.filter(
    (e) => present.has(fqnOf(e.fromEntity)) && present.has(fqnOf(e.toEntity))
  );
  // Walk out from the root once; each node remembers the node it came from.
  const cameFrom = new Map<string, string>([[fqnOf(root), '']]);
  const queue = [fqnOf(root)];
  while (queue.length) {
    const at = queue.shift() ?? '';
    for (const e of inGraph) {
      const ends = [fqnOf(e.fromEntity), fqnOf(e.toEntity)];
      const next = ends.find((end, i) => ends[1 - i] === at && end !== at);
      if (next && !cameFrom.has(next)) {
        cameFrom.set(next, at);
        queue.push(next);
      }
    }
  }
  const kept = new Set([fqnOf(root)]);
  nodes
    .filter(({ doc }) => matchesQueryFilter(doc, queryFilter))
    .filter(({ doc }) => cameFrom.has(fqnOf(doc)))
    .forEach(({ doc }) => {
      for (let f = fqnOf(doc); f && !kept.has(f); f = cameFrom.get(f) ?? '') {
        kept.add(f);
      }
    });
  const upstreamFqns = new Set(
    nodes.filter(({ depth }) => depth < 0).map(({ doc }) => fqnOf(doc))
  );
  const keptEdges = inGraph.filter(
    (e) => kept.has(fqnOf(e.fromEntity)) && kept.has(fqnOf(e.toEntity))
  );
  const keyed = (list: EdgeDetails[]) =>
    Object.fromEntries(
      list.map((e) => [`${fqnOf(e.fromEntity)}-->${fqnOf(e.toEntity)}`, e])
    );

  return {
    nodes: Object.fromEntries(
      [{ doc: root, depth: 0 }, ...nodes]
        .filter(({ doc }) => kept.has(fqnOf(doc)))
        .map(({ doc, depth }) => [
          fqnOf(doc),
          // A search document names its type in entityType too.
          {
            entity: { entityType: doc.type, ...doc },
            nodeDepth: depth,
            paging: {},
          },
        ])
    ),
    upstreamEdges: keyed(
      keptEdges.filter((e) => upstreamFqns.has(fqnOf(e.fromEntity)))
    ),
    downstreamEdges: keyed(
      keptEdges.filter((e) => !upstreamFqns.has(fqnOf(e.fromEntity)))
    ),
  };
};

/** An entity-level edge between two lineage nodes. */
export const edgeBetween = (
  from: LineageDoc,
  to: LineageDoc,
  details: Partial<EdgeDetails> = {}
): EdgeDetails => ({
  fromEntity: { id: from.id, type: from.type, fullyQualifiedName: fqnOf(from) },
  toEntity: { id: to.id, type: to.type, fullyQualifiedName: fqnOf(to) },
  ...details,
});

export interface ServeLineageSpec {
  /** The entity whose Lineage tab is open; the shared root table by default. */
  root?: LineageDoc;
  upstream?: LineageNode[];
  downstream?: LineageNode[];
  /**
   * The canvas's edges. By default each depth-1 node is joined to the root;
   * deeper nodes need their edges listed here.
   */
  edges?: EdgeDetails[];
  /** Downstream column edges from the root, for the Column level view. */
  columnEdges?: EdgeDetails[];
  /** Quick-filter options: aggregation field -> bucket keys. */
  facets?: Record<string, string[]>;
}

/**
 * Serves the root table, an empty lineage scene (the hidden lineage map), the
 * filter facets, `getLineageByEntityCount` (Table level) and
 * `getLineage/{direction}` (Column level). Returns the URLs each received.
 */
export const serveLineage = ({
  root = rootDoc,
  upstream = [],
  downstream = [],
  edges,
  columnEdges = [],
  facets = {},
}: ServeLineageSpec = {}) => {
  const calls = {
    entityCount: [] as URL[],
    directional: [] as URL[],
    canvas: [] as URL[],
    /** Each PUT /lineage body, in order. */
    puts: [] as AddLineage[],
    /** Each DELETE /lineage path, in order. */
    deletes: [] as string[],
    /** Each CSV export request. */
    exports: [] as URL[],
  };
  let canvasEdges = edges ?? [
    ...upstream
      .filter(({ depth }) => depth === 1)
      .map(({ doc }) => edgeBetween(doc, root)),
    ...downstream
      .filter(({ depth }) => depth === 1)
      .map(({ doc }) => edgeBetween(root, doc)),
  ];

  worker.use(
    http.get('/api/v1/tables/name/:fqn', () => HttpResponse.json(LINEAGE_ROOT)),
    http.get('/api/v1/queries', () =>
      HttpResponse.json({ data: [], paging: { total: 0 } })
    ),
    http.get('/api/v1/lineage/scene', () =>
      HttpResponse.json({
        band: 'ASSET',
        lens: 'service',
        breadcrumb: [],
        nodes: [],
        edges: [],
      })
    ),
    http.post('/api/v1/search/aggregate', async ({ request }) => {
      const { fieldName, fieldValue = '.*' } = (await request.json()) as {
        fieldName: string;
        fieldValue?: string;
      };
      // fieldValue is the terms aggregation's `include` regex (`.*text.*`).
      const include = new RegExp(`^${fieldValue}$`, 'i');
      const keys = (facets[fieldName] ?? []).filter((key) => include.test(key));

      return HttpResponse.json({
        hits: { total: { value: keys.length }, hits: [] },
        aggregations: {
          [`sterms#${fieldName}`]: {
            buckets: keys.map((key) => ({ key, doc_count: 1 })),
          },
        },
      });
    }),
    http.get('/api/v1/lineage/getLineageByEntityCount', ({ request }) => {
      const url = new URL(request.url);
      calls.entityCount.push(url);
      const params = url.searchParams;
      const filter = params.get('query_filter');
      const keep = (nodes: LineageNode[]) =>
        nodes.filter(({ doc }) => matchesQueryFilter(doc, filter));
      const up = keep(upstream);
      const down = keep(downstream);
      const nodeDepth = Number(params.get('nodeDepth') ?? 1);
      const from = Number(params.get('from') ?? 0);
      const size = Number(params.get('size') ?? 15);
      const page = (
        params.get('direction') === LineageDirection.Upstream ? up : down
      )
        .filter(({ depth }) => depth <= nodeDepth)
        .slice(from, from + size);

      return HttpResponse.json({
        nodes: Object.fromEntries([
          [rootDoc.fullyQualifiedName, { entity: rootDoc, nodeDepth: 0 }],
          ...page.map(({ doc, depth }) => [
            doc.fullyQualifiedName,
            { entity: doc, nodeDepth: depth, paging: {} },
          ]),
        ]),
        upstreamEdges: {},
        downstreamEdges: {},
        ...(params.get('include_pagination_info') === 'false'
          ? {}
          : { paginationInfo: paginationInfo(up, down) }),
      });
    }),
    // LineageResource#addLineage: one edge per pair, its details replaced.
    http.put('/api/v1/lineage', async ({ request }) => {
      const body = (await request.json()) as AddLineage;
      calls.puts.push(body);
      const { fromEntity, toEntity, lineageDetails } = body.edge;
      const docs = [root, ...[...upstream, ...downstream].map((n) => n.doc)];
      const doc = (id: string) => docs.find((d) => d.id === id);
      const from = doc(fromEntity.id);
      const to = doc(toEntity.id);
      if (!from || !to) {
        return HttpResponse.json({ code: 404 }, { status: 404 });
      }
      canvasEdges = [
        ...canvasEdges.filter(
          (e) => !(e.fromEntity.id === from.id && e.toEntity.id === to.id)
        ),
        edgeBetween(from, to, {
          pipeline: lineageDetails?.pipeline,
          columns: lineageDetails?.columnsLineage,
          sqlQuery: lineageDetails?.sqlQuery,
          description: lineageDetails?.description,
          source: lineageDetails?.source,
        }),
      ];

      return HttpResponse.json(body);
    }),
    http.delete(
      '/api/v1/lineage/:fromType/:fromId/:toType/:toId',
      ({ request, params }) => {
        calls.deletes.push(new URL(request.url).pathname);
        canvasEdges = canvasEdges.filter(
          (e) =>
            !(
              e.fromEntity.id === params.fromId && e.toEntity.id === params.toId
            )
        );

        return HttpResponse.json({});
      }
    ),
    // LineageRepository#getLineageEdge: the stored details of one edge.
    http.get('/api/v1/lineage/getLineageEdge/:fromId/:toId', ({ params }) => {
      const edge = canvasEdges.find(
        (e) =>
          e.fromEntity.id === params.fromId && e.toEntity.id === params.toId
      );

      return edge
        ? HttpResponse.json({
            edge: {
              pipeline: edge.pipeline,
              columnsLineage: edge.columns ?? [],
              sqlQuery: edge.sqlQuery,
              description: edge.description,
              source: edge.source,
            },
          })
        : HttpResponse.json({ code: 404 }, { status: 404 });
    }),
    // The CSV export starts a job; its result arrives over the websocket.
    http.get('/api/v1/lineage/exportAsync', ({ request }) => {
      calls.exports.push(new URL(request.url));

      return HttpResponse.json({
        jobId: `export-job-${calls.exports.length}`,
        message: 'Export initiated successfully.',
      });
    }),
    // A node's drawer is the entity summary panel: its lineage section, and
    // for a table its queries and data quality, here none.
    http.get('/api/v1/lineage/getPaginationInfo', () =>
      HttpResponse.json(paginationInfo(upstream, downstream))
    ),
    http.get('/api/v1/search/query', ({ request }) =>
      new URL(request.url).searchParams.get('index') === 'query'
        ? HttpResponse.json({ hits: { total: { value: 0 }, hits: [] } })
        : undefined
    ),
    http.get('/api/v1/dataQuality/testCases', () =>
      HttpResponse.json(EMPTY_LIST)
    ),
    http.get('/api/v1/dataQuality/testCases/testCaseIncidentStatus', () =>
      HttpResponse.json(EMPTY_LIST)
    ),
    http.get('/api/v1/lineage/getLineage', ({ request }) => {
      const url = new URL(request.url);
      calls.canvas.push(url);
      const params = url.searchParams;
      const within = (nodes: LineageNode[], param: string) =>
        nodes.filter(({ depth }) => depth <= Number(params.get(param) ?? 1));

      return HttpResponse.json(
        canvasLineage(
          root,
          [
            ...within(upstream, 'upstreamDepth').map((n) => ({
              ...n,
              depth: -n.depth,
            })),
            ...within(downstream, 'downstreamDepth'),
          ],
          canvasEdges,
          params.get('query_filter')
        )
      );
    }),
    http.get('/api/v1/lineage/getLineage/:direction', ({ request }) => {
      const url = new URL(request.url);
      calls.directional.push(url);
      // column_filter "columnName:x,..." keeps the column mappings that name x.
      const names = (url.searchParams.get('column_filter') ?? '')
        .split(',')
        .filter((f) => f.startsWith('columnName:'))
        .map((f) => f.slice('columnName:'.length));
      const nameOf = (fqn: string) => fqn.split('.').pop() ?? '';
      // The column mappings stored on the canvas's edges count too.
      const edges = [...columnEdges, ...canvasEdges]
        .map((edge) => ({
          ...edge,
          columns: (edge.columns ?? []).filter(
            (col) =>
              names.length === 0 ||
              [col.toColumn ?? '', ...(col.fromColumns ?? [])].some((c) =>
                names.includes(nameOf(c))
              )
          ),
        }))
        .filter((edge) => edge.columns.length > 0);
      const docs = downstream.map(({ doc }) => doc);

      return HttpResponse.json({
        nodes: Object.fromEntries(
          [rootDoc, ...docs].map((doc) => [
            doc.fullyQualifiedName,
            { entity: doc, nodeDepth: doc === rootDoc ? 0 : 1 },
          ])
        ),
        upstreamEdges: {},
        downstreamEdges: Object.fromEntries(
          edges.map((edge) => [
            `${edge.fromEntity.fullyQualifiedName}-->${edge.toEntity.fullyQualifiedName}`,
            edge,
          ])
        ),
      });
    })
  );

  return calls;
};

/** An edge from the root to `to` carrying column mappings (from -> to name). */
export const columnEdge = (
  to: LineageDoc,
  mappings: Array<[from: string, to: string]>
): EdgeDetails => ({
  fromEntity: {
    id: rootDoc.id,
    type: 'table',
    fullyQualifiedName: rootDoc.fullyQualifiedName,
  },
  toEntity: {
    id: to.id,
    type: to.type,
    fullyQualifiedName: to.fullyQualifiedName,
  },
  columns: mappings.map(([from, toCol]) => ({
    fromColumns: [`${rootDoc.fullyQualifiedName}.${from}`],
    toColumn: `${to.fullyQualifiedName}.${toCol}`,
  })),
});
