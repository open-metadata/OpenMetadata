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

import type { TFunction } from 'i18next';
import { EntityType } from '../../../enums/entity.enum';
import {
  LineageBand,
  LineageLens,
  LineageLevelKind,
  LineageScene,
  LineageSceneBreadcrumb,
  LineageSceneNode,
} from '../../../generated/api/lineage/lineageScene';
import {
  buildLineagePathHighlightIndex,
  getBreadcrumbSceneRequest,
  getConnectedFieldLineagePathHighlight,
  getConnectedLineagePathHighlight,
  getDrillBand,
  getLensRootLabelKey,
  getParentSceneRequest,
  getSceneFocus,
  getSceneLevelLabelKey,
  getSceneNodeCountSubtitle,
  getSceneOriginFocus,
  getSceneRequestFromSearch,
  getSceneSearch,
} from './LineageMap.utils';

describe('scene focus validation', () => {
  it('preserves a valid entity focus', () => {
    expect(getSceneFocus('service.db.schema.table', EntityType.TABLE)).toEqual({
      focusFqn: 'service.db.schema.table',
      entityType: EntityType.TABLE,
    });
  });

  it.each([undefined, ''])(
    'does not send an incomplete focus: %s',
    (entityType) => {
      expect(getSceneFocus('service.db', entityType)).toEqual({});
    }
  );
});

describe('scene URL navigation', () => {
  const defaultFocus = {
    focusFqn: 'service.db.table',
    entityType: EntityType.TABLE,
  };

  it('round-trips quoted FQNs containing query-string delimiters', () => {
    const request = {
      lens: LineageLens.Service,
      band: LineageBand.Field,
      focusFqn: 'service.db."orders & returns?region=us#1"',
      entityType: EntityType.TABLE,
    };
    const search = getSceneSearch('?mode=lineage', request);

    expect(new URLSearchParams(search).get('mode')).toBe('lineage');
    expect(getSceneRequestFromSearch(search, defaultFocus)).toEqual(request);
  });

  it('preserves custom entity types across URL, breadcrumb, parent and origin navigation', () => {
    const focus = {
      focusFqn: 'custom."asset & fields"',
      entityType: 'customAsset',
    };
    const request = {
      ...focus,
      lens: LineageLens.Service,
      band: LineageBand.Field,
    };
    const scene: LineageScene = {
      lens: request.lens,
      band: request.band,
      nodes: [],
      edges: [],
      breadcrumb: [],
      focusFqn: focus.focusFqn,
      focusEntityType: focus.entityType,
      originFqn: focus.focusFqn,
      originEntityType: focus.entityType,
    };
    const breadcrumb: LineageSceneBreadcrumb = {
      id: 'custom',
      label: 'custom',
      fullyQualifiedName: focus.focusFqn,
      entityType: focus.entityType,
      band: LineageBand.Asset,
      levelKind: LineageLevelKind.Asset,
    };

    expect(getSceneFocus(focus.focusFqn, focus.entityType)).toEqual(focus);
    expect(
      getSceneRequestFromSearch(getSceneSearch('', request), defaultFocus)
    ).toEqual(request);
    expect(getBreadcrumbSceneRequest(scene, breadcrumb)).toEqual({
      ...request,
      band: LineageBand.Asset,
    });
    expect(getParentSceneRequest(scene)).toEqual({
      ...request,
      band: LineageBand.Asset,
    });
    expect(getSceneOriginFocus(scene, {})).toEqual(focus);
  });

  it('removes the previous focus when navigating to a root breadcrumb', () => {
    const request = { lens: LineageLens.Domain, band: LineageBand.Layer };
    const search = getSceneSearch(
      '?lineageFocus=service.db.table&lineageEntityType=table',
      request
    );

    expect(getSceneRequestFromSearch(search, defaultFocus)).toEqual(request);
  });

  it('uses the current route entity when no focus has been selected', () => {
    const nextFocus = {
      focusFqn: 'service.db.other',
      entityType: EntityType.TABLE,
    };

    expect(getSceneRequestFromSearch('', defaultFocus).focusFqn).toBe(
      defaultFocus.focusFqn
    );
    expect(getSceneRequestFromSearch('', nextFocus).focusFqn).toBe(
      nextFocus.focusFqn
    );
  });

  it.each([{}, defaultFocus])(
    'recenters the entity-page table after reloading a Layer URL with focus %j',
    (focus) => {
      const request = {
        lens: LineageLens.Service,
        band: LineageBand.Layer,
        ...focus,
      };
      const search = getSceneSearch('', request);
      const reloaded = getSceneRequestFromSearch(search, defaultFocus);

      expect(reloaded).toEqual(request);

      const scene: LineageScene = {
        ...request,
        nodes: [],
        edges: [],
        breadcrumb: [],
      };
      const recentered = {
        lens: scene.lens,
        band: LineageBand.Asset,
        ...getSceneOriginFocus(scene, defaultFocus),
      };

      expect(
        getSceneRequestFromSearch(
          getSceneSearch(search, recentered),
          defaultFocus
        )
      ).toEqual({
        lens: LineageLens.Service,
        band: LineageBand.Asset,
        ...defaultFocus,
      });
    }
  );

  it('keeps the original route table as the recenter target after drilling elsewhere', () => {
    const scene = {
      lens: LineageLens.Service,
      band: LineageBand.Asset,
      nodes: [],
      edges: [],
      breadcrumb: [],
      originFqn: 'service.db.other',
      originEntityType: EntityType.TABLE,
    };

    expect(getSceneOriginFocus(scene, defaultFocus)).toEqual(defaultFocus);
    expect(getSceneOriginFocus(scene, {})).toEqual({
      focusFqn: scene.originFqn,
      entityType: EntityType.TABLE,
    });
  });
});

const t = ((key: string, options?: Record<string, string | number>) => {
  const labels: Record<string, string> = {
    'label.asset-plural': 'Assets',
    'label.schema': 'Schema',
    'label.service': 'Service',
    'label.table-plural': 'Tables',
  };

  if (key === 'label.lineage-map-node-count-subtitle') {
    return `${options?.kind} · ${options?.count} ${options?.entity}`;
  }

  return labels[key] ?? key;
}) as TFunction;

const createScene = (
  band: LineageBand,
  levelKinds: LineageLevelKind[]
): LineageScene => ({
  lens: LineageLens.Service,
  band,
  nodes: levelKinds.map((levelKind, index) => ({
    id: `node-${index}`,
    label: `node-${index}`,
    levelKind,
    band,
  })),
  edges: [],
  breadcrumb: [],
});

const createBreadcrumb = (
  label: string,
  levelKind: LineageLevelKind,
  band: LineageBand,
  fullyQualifiedName?: string,
  entityType?: string
): LineageSceneBreadcrumb => ({
  id: `${levelKind}-${label}`,
  label,
  levelKind,
  band,
  fullyQualifiedName,
  entityType,
});

const createTableFocusedScene = (band = LineageBand.Asset): LineageScene => ({
  ...createScene(band, [LineageLevelKind.Table]),
  focusFqn: 'sample_data.ecommerce_db.shopify.dim_customer',
  focusEntityType: 'table',
  breadcrumb: [
    createBreadcrumb('service', LineageLevelKind.Service, LineageBand.Layer),
    createBreadcrumb(
      'sample_data',
      LineageLevelKind.Service,
      LineageBand.Layer,
      'sample_data',
      'databaseService'
    ),
    createBreadcrumb(
      'ecommerce_db',
      LineageLevelKind.Database,
      LineageBand.Asset,
      'sample_data.ecommerce_db',
      'database'
    ),
    createBreadcrumb(
      'shopify',
      LineageLevelKind.Schema,
      LineageBand.Asset,
      'sample_data.ecommerce_db.shopify',
      'databaseSchema'
    ),
    createBreadcrumb(
      'dim_customer',
      LineageLevelKind.Table,
      LineageBand.Asset,
      'sample_data.ecommerce_db.shopify.dim_customer',
      'table'
    ),
  ],
});

describe('LineageMap utils', () => {
  it('returns the visible hierarchy level for single-level asset scenes', () => {
    expect(
      getSceneLevelLabelKey(
        createScene(LineageBand.Asset, [LineageLevelKind.Database])
      )
    ).toBe('label.lineage-map-database-level');

    expect(
      getSceneLevelLabelKey(
        createScene(LineageBand.Asset, [LineageLevelKind.Schema])
      )
    ).toBe('label.lineage-map-schema-level');

    expect(
      getSceneLevelLabelKey(
        createScene(LineageBand.Asset, [LineageLevelKind.Table])
      )
    ).toBe('label.lineage-map-table-level');

    expect(
      getSceneLevelLabelKey(
        createScene(LineageBand.Asset, [LineageLevelKind.Pipeline])
      )
    ).toBe('label.lineage-map-pipeline-level');
  });

  it('uses concrete level label when rollup container anchors are present', () => {
    expect(
      getSceneLevelLabelKey(
        createScene(LineageBand.Asset, [
          LineageLevelKind.Table,
          LineageLevelKind.Service,
        ])
      )
    ).toBe('label.lineage-map-table-level');
  });

  it('returns field level for field-band scenes', () => {
    expect(
      getSceneLevelLabelKey(
        createScene(LineageBand.Field, [LineageLevelKind.Table])
      )
    ).toBe('label.lineage-map-field-level');
  });

  it('falls back to the band label for mixed-level scenes', () => {
    expect(
      getSceneLevelLabelKey(
        createScene(LineageBand.Asset, [
          LineageLevelKind.Table,
          LineageLevelKind.Topic,
        ])
      )
    ).toBe('label.data-asset-plural');
  });

  it('keeps service, database, and schema drill-down on focused asset scenes', () => {
    [
      LineageLevelKind.Service,
      LineageLevelKind.Database,
      LineageLevelKind.Schema,
    ].forEach((levelKind) => {
      expect(
        getDrillBand({
          id: levelKind,
          label: levelKind,
          band:
            levelKind === LineageLevelKind.Service
              ? LineageBand.Layer
              : LineageBand.Asset,
          levelKind,
        } as LineageSceneNode)
      ).toBe(LineageBand.Asset);
    });
  });

  it('drills concrete assets into field scenes', () => {
    expect(
      getDrillBand({
        id: 'table',
        label: 'table',
        band: LineageBand.Asset,
        levelKind: LineageLevelKind.Table,
      } as LineageSceneNode)
    ).toBe(LineageBand.Field);
  });

  it('uses translated root labels for scene breadcrumbs', () => {
    expect(getLensRootLabelKey(LineageLens.Service)).toBe(
      'label.all-service-plural'
    );
    expect(getLensRootLabelKey(LineageLens.Domain)).toBe(
      'label.all-domain-plural'
    );
    expect(getLensRootLabelKey(LineageLens.DataProduct)).toBe(
      'label.all-data-product-plural'
    );
  });

  it('maps root breadcrumb clicks to the layer scene', () => {
    const scene = createTableFocusedScene();

    expect(getBreadcrumbSceneRequest(scene, scene.breadcrumb[0])).toEqual({
      lens: LineageLens.Service,
      band: LineageBand.Layer,
    });
  });

  it('maps service breadcrumb clicks to focused asset scenes', () => {
    const scene = createTableFocusedScene();

    expect(getBreadcrumbSceneRequest(scene, scene.breadcrumb[1])).toEqual({
      lens: LineageLens.Service,
      band: LineageBand.Asset,
      focusFqn: 'sample_data',
      entityType: 'databaseService',
    });
  });

  it('uses breadcrumb ancestry when zooming out from asset scenes', () => {
    expect(getParentSceneRequest(createTableFocusedScene())).toEqual({
      lens: LineageLens.Service,
      band: LineageBand.Asset,
      focusFqn: 'sample_data.ecommerce_db.shopify',
      entityType: 'databaseSchema',
    });
  });

  it('zooms field scenes back to the same asset scene', () => {
    expect(
      getParentSceneRequest(createTableFocusedScene(LineageBand.Field))
    ).toEqual({
      lens: LineageLens.Service,
      band: LineageBand.Asset,
      focusFqn: 'sample_data.ecommerce_db.shopify.dim_customer',
      entityType: 'table',
    });
  });

  it('builds connected path highlights for hovered nodes', () => {
    const index = buildLineagePathHighlightIndex([
      { id: 'asset-a-to-asset-b', source: 'asset-a', target: 'asset-b' },
      { id: 'asset-b-to-asset-c', source: 'asset-b', target: 'asset-c' },
      { id: 'asset-c-to-asset-d', source: 'asset-c', target: 'asset-d' },
      { id: 'asset-x-to-asset-y', source: 'asset-x', target: 'asset-y' },
    ]);

    const highlight = getConnectedLineagePathHighlight('asset-b', index);

    expect(highlight?.edgeIds).toEqual(
      new Set([
        'asset-a-to-asset-b',
        'asset-b-to-asset-c',
        'asset-c-to-asset-d',
      ])
    );
    expect(highlight?.nodeIds).toEqual(
      new Set(['asset-b', 'asset-a', 'asset-c', 'asset-d'])
    );
  });

  it('does not build a path highlight without a hovered node', () => {
    const index = buildLineagePathHighlightIndex([
      { id: 'asset-a-to-asset-b', source: 'asset-a', target: 'asset-b' },
    ]);

    expect(getConnectedLineagePathHighlight(undefined, index)).toBeUndefined();
  });

  it('builds directed field lineage highlights for selected fields', () => {
    const index = buildLineagePathHighlightIndex([
      {
        id: 'raw-to-fact',
        source: 'raw_customer',
        target: 'fact_orders',
        sourceHandle: 'raw_customer.orders',
        targetHandle: 'fact_orders.total_orders',
      },
      {
        id: 'fact-to-feature',
        source: 'fact_orders',
        target: 'customer_features',
        sourceHandle: 'fact_orders.total_orders',
        targetHandle: 'customer_features.total_orders',
      },
      {
        id: 'raw-to-unrelated',
        source: 'raw_customer',
        target: 'dim_customer',
        sourceHandle: 'raw_customer.orders',
        targetHandle: 'dim_customer.customer_orders',
      },
      {
        id: 'sibling-to-feature',
        source: 'dim_customer',
        target: 'customer_features',
        sourceHandle: 'dim_customer.customer_orders',
        targetHandle: 'customer_features.total_orders',
      },
    ]);

    const highlight = getConnectedFieldLineagePathHighlight(
      'fact_orders.total_orders',
      index
    );

    expect(highlight?.edgeIds).toEqual(
      new Set(['raw-to-fact', 'fact-to-feature'])
    );
    expect(highlight?.fieldIds).toEqual(
      new Set([
        'fact_orders.total_orders',
        'raw_customer.orders',
        'customer_features.total_orders',
      ])
    );
    expect(highlight?.nodeIds).toEqual(
      new Set(['fact_orders', 'raw_customer', 'customer_features'])
    );
  });

  it('does not build a field path highlight without a selected field', () => {
    const index = buildLineagePathHighlightIndex([
      {
        id: 'raw-to-fact',
        source: 'raw_customer',
        target: 'fact_orders',
        sourceHandle: 'raw_customer.orders',
        targetHandle: 'fact_orders.total_orders',
      },
    ]);

    expect(
      getConnectedFieldLineagePathHighlight(undefined, index)
    ).toBeUndefined();
  });

  it('formats semantic node count subtitles from concrete asset counts', () => {
    const subtitle = getSceneNodeCountSubtitle(
      {
        id: 'schema:sample_data.ecommerce_db.shopify',
        label: 'shopify',
        band: LineageBand.Asset,
        levelKind: LineageLevelKind.Schema,
        counts: {
          [LineageLevelKind.Table]: 14,
        },
      },
      t
    );

    expect(subtitle).toBe('schema · 14 tables');
  });

  it('falls back to asset count labels for mixed concrete counts', () => {
    const subtitle = getSceneNodeCountSubtitle(
      {
        id: 'service:sample_data',
        label: 'sample_data',
        band: LineageBand.Layer,
        levelKind: LineageLevelKind.Service,
        counts: {
          [LineageLevelKind.Table]: 2,
          [LineageLevelKind.Dashboard]: 1,
        },
      },
      t
    );

    expect(subtitle).toBe('service · 3 assets');
  });

  it('does not include field counts in container asset subtitles', () => {
    const subtitle = getSceneNodeCountSubtitle(
      {
        id: 'service:sample_data',
        label: 'sample_data',
        band: LineageBand.Layer,
        levelKind: LineageLevelKind.Service,
        counts: {
          [LineageLevelKind.Column]: 275,
          [LineageLevelKind.Table]: 25,
        },
      },
      t
    );

    expect(subtitle).toBe('service · 25 tables');
  });
});
