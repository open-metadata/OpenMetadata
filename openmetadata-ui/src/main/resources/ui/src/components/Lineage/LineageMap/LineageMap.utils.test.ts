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
import type { Viewport } from 'reactflow';
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
  getBoxNearestPoint,
  getBreadcrumbSceneRequest,
  getConnectedFieldLineagePathHighlight,
  getConnectedLineagePathHighlight,
  getDeleteKeyAction,
  getDrillBand,
  getDrilledRootBreadcrumb,
  getLensRootLabelKey,
  getLineageMapEmptyState,
  getParentSceneRequest,
  getRailDrillFallbackNode,
  getRailStop,
  getRailStopLabelKey,
  getSceneFocus,
  getSceneLandingViewport,
  getSceneLevelLabelKey,
  getSceneNodeCount,
  getSceneNodeTypeSubtitle,
  getSceneOriginFocus,
  getSceneRequestFromSearch,
  getSceneSearch,
  getScreenFill,
  getSemanticZoomDirection,
  isSceneNodeDrillableWithChildren,
  type SceneLayoutBox,
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

  it('offers the root breadcrumb as the way back only once drilled in', () => {
    const root: LineageSceneBreadcrumb = {
      id: 'root',
      label: 'root',
      band: LineageBand.Layer,
      levelKind: LineageLevelKind.Service,
    };
    const service: LineageSceneBreadcrumb = {
      id: 'svc',
      label: 'svc',
      fullyQualifiedName: 'svc',
      entityType: EntityType.DATABASE_SERVICE,
      band: LineageBand.Layer,
      levelKind: LineageLevelKind.Service,
    };

    expect(
      getDrilledRootBreadcrumb({
        breadcrumb: [root, service],
        band: LineageBand.Asset,
        focusFqn: 'svc',
      })
    ).toBe(root);
    // An empty drilled scene carries only the root crumb.
    expect(
      getDrilledRootBreadcrumb({
        breadcrumb: [root],
        band: LineageBand.Asset,
        focusFqn: 'svc',
      })
    ).toBe(root);
    expect(
      getDrilledRootBreadcrumb({ breadcrumb: [root], band: LineageBand.Layer })
    ).toBeUndefined();
    expect(getDrilledRootBreadcrumb(undefined)).toBeUndefined();
  });

  it('removes the previous focus when navigating to a root breadcrumb', () => {
    const request = { lens: LineageLens.Domain, band: LineageBand.Layer };
    const search = getSceneSearch(
      '?lineageFocus=service.db.table&lineageEntityType=table',
      request
    );

    expect(getSceneRequestFromSearch(search, defaultFocus, true)).toEqual(
      request
    );
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

  it('opens the platform root at the service level without an entity focus', () => {
    expect(getSceneRequestFromSearch('', {}, true)).toEqual({
      lens: LineageLens.Service,
      band: LineageBand.Layer,
    });
  });

  it.each([
    defaultFocus,
    {
      focusFqn: 'service.db."orders & returns?region=us#1"',
      entityType: EntityType.TABLE,
    },
    { focusFqn: 'service.dashboard', entityType: EntityType.DASHBOARD },
  ])('opens a focused platform route at the asset level: %j', (focus) => {
    expect(getSceneRequestFromSearch('', focus, true)).toEqual({
      lens: LineageLens.Service,
      band: LineageBand.Asset,
      ...focus,
    });
  });

  it('clears a platform route focus when explicitly navigating to the root', () => {
    const request = { lens: LineageLens.Service, band: LineageBand.Layer };

    expect(
      getSceneRequestFromSearch(getSceneSearch('', request), defaultFocus, true)
    ).toEqual(request);
  });

  it.each([{}, defaultFocus])(
    'keeps an asset page Layer view focused on its asset, focus %j',
    (focus) => {
      const search = getSceneSearch('', {
        lens: LineageLens.Domain,
        band: LineageBand.Layer,
        ...focus,
      });

      expect(getSceneRequestFromSearch(search, defaultFocus)).toEqual({
        lens: LineageLens.Domain,
        band: LineageBand.Layer,
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

  if (key === 'label.lineage-map-node-type-subtitle') {
    return `${options?.type} · ${options?.kind}`;
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
  it('maps scenes onto the three rail stops', () => {
    expect(
      getRailStop(createScene(LineageBand.Layer, [LineageLevelKind.Service]))
    ).toBe(LineageBand.Layer);
    // A drilled-into service lists databases / schemas in the Layer band;
    // the rail reads those as Data Assets.
    expect(
      getRailStop(
        createScene(LineageBand.Layer, [
          LineageLevelKind.Service,
          LineageLevelKind.Database,
        ])
      )
    ).toBe(LineageBand.Asset);
    expect(
      getRailStop(createScene(LineageBand.Layer, [LineageLevelKind.Schema]))
    ).toBe(LineageBand.Asset);
    expect(
      getRailStop(createScene(LineageBand.Asset, [LineageLevelKind.Table]))
    ).toBe(LineageBand.Asset);
    expect(
      getRailStop(createScene(LineageBand.Field, [LineageLevelKind.Table]))
    ).toBe(LineageBand.Field);
  });

  it('labels the first rail stop after the lens', () => {
    expect(getRailStopLabelKey(LineageBand.Layer, LineageLens.Service)).toBe(
      'label.service-level-view'
    );
    expect(getRailStopLabelKey(LineageBand.Layer, LineageLens.Domain)).toBe(
      'label.domain'
    );
    expect(getRailStopLabelKey(LineageBand.Asset, LineageLens.Domain)).toBe(
      'label.data-asset-plural'
    );
    expect(getRailStopLabelKey(LineageBand.Field, LineageLens.Service)).toBe(
      'label.field-level-lineage'
    );
  });

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

  describe('getRailDrillFallbackNode', () => {
    const service = (name: string, childrenCount: number): LineageSceneNode =>
      ({
        id: `service:${name}`,
        label: name,
        fullyQualifiedName: name,
        entityType: EntityType.DATABASE_SERVICE,
        band: LineageBand.Layer,
        levelKind: LineageLevelKind.Service,
        isExpandable: true,
        childrenCount,
      } as LineageSceneNode);

    it('skips an empty service listed first for one that has assets', () => {
      expect(
        getRailDrillFallbackNode([service('empty', 0), service('full', 64)])
          ?.fullyQualifiedName
      ).toBe('full');
    });

    it('treats an empty or non-expandable node as no unaimed drill target', () => {
      expect(isSceneNodeDrillableWithChildren(service('full', 64))).toBe(true);
      expect(isSceneNodeDrillableWithChildren(service('empty', 0))).toBe(false);
      expect(
        isSceneNodeDrillableWithChildren({
          ...service('ghost', 5),
          isExpandable: false,
        })
      ).toBe(false);
    });

    it('falls back to the first drillable node when none report children', () => {
      expect(
        getRailDrillFallbackNode([
          { ...service('ghost', 5), isExpandable: false },
          service('first', 0),
          service('second', 0),
        ])?.fullyQualifiedName
      ).toBe('first');
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

  it('counts the concrete assets a container holds', () => {
    expect(
      getSceneNodeCount(
        {
          id: 'schema:sample_data.ecommerce_db.shopify',
          label: 'shopify',
          band: LineageBand.Asset,
          levelKind: LineageLevelKind.Schema,
          counts: { [LineageLevelKind.Table]: 14 },
        },
        t
      )
    ).toEqual({ count: 14, entity: 'tables' });
  });

  it('falls back to an asset count for mixed concrete counts', () => {
    expect(
      getSceneNodeCount(
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
      )
    ).toEqual({ count: 3, entity: 'assets' });
  });

  it('does not count fields towards a container', () => {
    expect(
      getSceneNodeCount(
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
      )
    ).toEqual({ count: 25, entity: 'tables' });
  });

  it('describes a container by its service type and kind', () => {
    const service = {
      id: 'service:sample_data',
      label: 'sample_data',
      band: LineageBand.Layer,
      levelKind: LineageLevelKind.Service,
    };

    expect(
      getSceneNodeTypeSubtitle({ ...service, serviceType: 'Snowflake' }, t)
    ).toBe('Snowflake · service');
    expect(getSceneNodeTypeSubtitle(service, t)).toBe('service');
  });

  it('leaves leaf assets without a container subtitle or count', () => {
    const table = {
      id: 'table:a',
      label: 'a',
      band: LineageBand.Asset,
      levelKind: LineageLevelKind.Table,
      counts: { [LineageLevelKind.Column]: 4 },
    };

    expect(getSceneNodeTypeSubtitle(table, t)).toBeUndefined();
    expect(getSceneNodeCount(table, t)).toBeUndefined();
  });
});

describe('getDeleteKeyAction', () => {
  const keyEvent = (key: string, target: HTMLElement = document.body) =>
    ({ key, target } as unknown as KeyboardEvent);

  it('returns node for Delete with a selected node', () => {
    expect(
      getDeleteKeyAction(keyEvent('Delete'), {
        canEdit: true,
        hasSelectedNode: true,
        hasSelectedEdge: false,
      })
    ).toBe('node');
  });

  it('returns edge for Backspace with only a selected edge', () => {
    expect(
      getDeleteKeyAction(keyEvent('Backspace'), {
        canEdit: true,
        hasSelectedNode: false,
        hasSelectedEdge: true,
      })
    ).toBe('edge');
  });

  it('ignores keys typed in inputs', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    expect(
      getDeleteKeyAction(keyEvent('Delete', input), {
        canEdit: true,
        hasSelectedNode: true,
        hasSelectedEdge: false,
      })
    ).toBeUndefined();
  });

  it('acts on keys pressed on the canvas', () => {
    const canvas = document.createElement('div');
    canvas.className = 'react-flow';
    const pane = document.createElement('div');
    canvas.appendChild(pane);
    document.body.appendChild(canvas);

    expect(
      getDeleteKeyAction(keyEvent('Delete', pane), {
        canEdit: true,
        hasSelectedNode: false,
        hasSelectedEdge: true,
      })
    ).toBe('edge');
  });

  it('ignores keys pressed in a drawer or other overlay', () => {
    const drawer = document.createElement('div');
    drawer.setAttribute('role', 'dialog');
    const closeButton = document.createElement('button');
    drawer.appendChild(closeButton);
    document.body.appendChild(drawer);

    expect(
      getDeleteKeyAction(keyEvent('Delete', closeButton), {
        canEdit: true,
        hasSelectedNode: true,
        hasSelectedEdge: true,
      })
    ).toBeUndefined();
  });

  it('ignores everything without edit permission', () => {
    expect(
      getDeleteKeyAction(keyEvent('Delete'), {
        canEdit: false,
        hasSelectedNode: true,
        hasSelectedEdge: false,
      })
    ).toBeUndefined();
  });
});

describe('box nearest a point', () => {
  it('measures to box centres, not edges', () => {
    const wide = { id: 'wide', x: 0, y: 0, width: 400, height: 40 };
    const small = { id: 'small', x: 0, y: 60, width: 40, height: 40 };

    // (20, 30) lies inside wide, 180 from its centre (200, 20), but only 50
    // from small's centre (20, 80).
    expect(getBoxNearestPoint([wide, small], { x: 20, y: 30 })?.id).toBe(
      'small'
    );
    expect(getBoxNearestPoint([wide, small], { x: 200, y: 30 })?.id).toBe(
      'wide'
    );
  });

  it('returns undefined without boxes', () => {
    expect(getBoxNearestPoint([], { x: 0, y: 0 })).toBeUndefined();
  });
});

describe('semantic zoom by screen fill', () => {
  const screen = { width: 1200, height: 800 };
  const card = { width: 400, height: 0 };
  // A large graph: 6000 x 4000 flow units.
  const bigGraph = { width: 6000, height: 4000 };

  it('measures the larger of the width and height share', () => {
    expect(getScreenFill({ width: 600, height: 100 }, 1, screen)).toBe(0.5);
    expect(getScreenFill({ width: 100, height: 800 }, 0.5, screen)).toBe(0.5);
  });

  it('keeps zooming out a large graph until it fits in a third of the screen', () => {
    // 0.15 zoom: 900 of 1200 wide, still most of the screen.
    expect(
      getSemanticZoomDirection({
        previousZoom: 0.2,
        zoom: 0.15,
        graph: bigGraph,
        card,
        screen,
        minZoom: 0.01,
        maxZoom: 10,
      })
    ).toBeUndefined();
    // 0.06 zoom: 360 of 1200 wide, under a third.
    expect(
      getSemanticZoomDirection({
        previousZoom: 0.07,
        zoom: 0.06,
        graph: bigGraph,
        card,
        screen,
        minZoom: 0.01,
        maxZoom: 10,
      })
    ).toBe('out');
  });

  it('goes up a level for a small graph that already fits', () => {
    expect(
      getSemanticZoomDirection({
        previousZoom: 1,
        zoom: 0.9,
        graph: { width: 400, height: 100 },
        card,
        screen,
        minZoom: 0.01,
        maxZoom: 10,
      })
    ).toBe('out');
  });

  it('goes down a level only once a card fills 35% of the screen', () => {
    // 1.0 zoom: 400 of 1200 wide, just under 35%.
    expect(
      getSemanticZoomDirection({
        previousZoom: 0.9,
        zoom: 1,
        graph: bigGraph,
        card,
        screen,
        minZoom: 0.01,
        maxZoom: 10,
      })
    ).toBeUndefined();
    // 1.1 zoom: 440 of 1200 wide, past 35%.
    expect(
      getSemanticZoomDirection({
        previousZoom: 1,
        zoom: 1.1,
        graph: bigGraph,
        card,
        screen,
        minZoom: 0.01,
        maxZoom: 10,
      })
    ).toBe('in');
  });

  it('goes up a level when zooming out reaches the minimum zoom', () => {
    expect(
      getSemanticZoomDirection({
        previousZoom: 0.12,
        zoom: 0.1,
        graph: { width: 60000, height: 40000 },
        card,
        screen,
        minZoom: 0.1,
        maxZoom: 10,
      })
    ).toBe('out');
  });

  it('goes down a level when zooming in reaches the maximum zoom', () => {
    expect(
      getSemanticZoomDirection({
        previousZoom: 2,
        zoom: 2.5,
        graph: bigGraph,
        card: { width: 100, height: 0 },
        screen,
        minZoom: 0.1,
        maxZoom: 2.5,
      })
    ).toBe('in');
  });

  it('never switches level while the zoom holds still', () => {
    expect(
      getSemanticZoomDirection({
        previousZoom: 0.05,
        zoom: 0.05,
        graph: bigGraph,
        card,
        screen,
        minZoom: 0.01,
        maxZoom: 10,
      })
    ).toBeUndefined();
  });
});

describe('scene landing viewport', () => {
  const canvas = { width: 1200, height: 640 };
  const minZoom = 0.55;
  const padding = 0.2;
  const inset = padding / (2 * (1 + padding));

  const box = (
    x: number,
    y: number,
    flags: Partial<SceneLayoutBox> = {}
  ): SceneLayoutBox => ({ x, y, width: 400, height: 66, ...flags });

  // A benchmark schema of 32 tables as the layered layout places it: 22 down
  // the first layer, the rest along the top of later layers, and the two
  // services their lineage rolls up to collapsed into context nodes mid-height.
  const schemaScene = [
    ...Array.from({ length: 22 }, (_, index) => box(12, 12 + index * 131)),
    ...[492, 972, 1452, 1932].flatMap((x) => [box(x, 12), box(x, 158)]),
    box(2412, 12),
    box(2892, 12),
    box(700, 1539, { isGhost: true }),
    box(1290, 1539, { isGhost: true }),
  ];

  const visibleBoxes = (boxes: SceneLayoutBox[], viewport: Viewport) => {
    const left = -viewport.x / viewport.zoom;
    const top = -viewport.y / viewport.zoom;
    const right = left + canvas.width / viewport.zoom;
    const bottom = top + canvas.height / viewport.zoom;

    return boxes.filter(
      (candidate) =>
        candidate.x < right &&
        candidate.x + candidate.width > left &&
        candidate.y < bottom &&
        candidate.y + candidate.height > top
    );
  };

  const screenCentre = (target: SceneLayoutBox, viewport: Viewport) => ({
    x: (target.x + target.width / 2) * viewport.zoom + viewport.x,
    y: (target.y + target.height / 2) * viewport.zoom + viewport.y,
  });

  it('leaves a scene that fits at the minimum zoom to a plain fit', () => {
    expect(
      getSceneLandingViewport(
        [box(0, 0), box(600, 0), box(600, 200)],
        canvas,
        minZoom,
        padding
      )
    ).toBeUndefined();
  });

  it('opens a scene too big to fit on its own nodes, not on the context nodes at its centre', () => {
    const centredOnScene = {
      x: canvas.width / 2 - ((12 + 3292) / 2) * minZoom,
      y: canvas.height / 2 - ((12 + 12 + 21 * 131 + 66) / 2) * minZoom,
      zoom: minZoom,
    };

    const viewport = getSceneLandingViewport(
      schemaScene,
      canvas,
      minZoom,
      padding
    );

    expect(
      visibleBoxes(schemaScene, centredOnScene).every(
        (candidate) => candidate.isGhost
      )
    ).toBe(true);
    expect(viewport?.zoom).toBe(minZoom);
    expect(
      visibleBoxes(schemaScene, viewport as Viewport).filter(
        (candidate) => !candidate.isGhost
      ).length
    ).toBeGreaterThanOrEqual(12);
  });

  it('places the top of the left-most real column at the fit inset, skipping context nodes further left', () => {
    const viewport = getSceneLandingViewport(
      [box(-600, 900, { isGhost: true }), ...schemaScene],
      canvas,
      minZoom,
      padding
    ) as Viewport;

    expect(12 * viewport.zoom + viewport.x).toBeCloseTo(canvas.width * inset);
    expect(12 * viewport.zoom + viewport.y).toBeCloseTo(canvas.height * inset);
  });

  it('centres the origin node of a scene too big to fit, and the focus node over it', () => {
    const origin = box(2412, 2600, { isOrigin: true });
    const focus = box(1452, 1200, { isFocus: true });

    const onOrigin = getSceneLandingViewport(
      [...schemaScene, origin],
      canvas,
      minZoom,
      padding
    ) as Viewport;
    const onFocus = getSceneLandingViewport(
      [...schemaScene, origin, focus],
      canvas,
      minZoom,
      padding
    ) as Viewport;

    expect(screenCentre(origin, onOrigin).x).toBeCloseTo(canvas.width / 2);
    expect(screenCentre(origin, onOrigin).y).toBeCloseTo(canvas.height / 2);
    expect(screenCentre(focus, onFocus).x).toBeCloseTo(canvas.width / 2);
    expect(screenCentre(focus, onFocus).y).toBeCloseTo(canvas.height / 2);
  });

  it('anchors on context nodes when a scene has nothing else', () => {
    const viewport = getSceneLandingViewport(
      [box(0, 3000, { isGhost: true }), box(0, 0, { isGhost: true })],
      canvas,
      minZoom,
      padding
    ) as Viewport;

    expect(viewport.y).toBeCloseTo(canvas.height * inset);
  });

  it('waits for a measured canvas', () => {
    expect(
      getSceneLandingViewport(
        schemaScene,
        { width: 0, height: 0 },
        minZoom,
        padding
      )
    ).toBeUndefined();
  });
});

describe('getLineageMapEmptyState', () => {
  const emptyScene = {
    lens: LineageLens.Service,
    band: LineageBand.Asset,
    nodes: [],
    edges: [],
  } as unknown as LineageScene;

  it('shows the skeleton while the first scene loads', () => {
    expect(getLineageMapEmptyState({ loading: true, hasError: false })).toBe(
      'loading'
    );
    expect(getLineageMapEmptyState({ loading: true, hasError: true })).toBe(
      'loading'
    );
  });

  it('shows the error state when the first scene failed', () => {
    expect(getLineageMapEmptyState({ loading: false, hasError: true })).toBe(
      'error'
    );
  });

  it('shows the empty state for a scene with no nodes, even on a failed refetch', () => {
    expect(
      getLineageMapEmptyState({
        scene: emptyScene,
        loading: false,
        hasError: true,
      })
    ).toBe('empty');
    expect(
      getLineageMapEmptyState({
        scene: emptyScene,
        loading: true,
        hasError: false,
      })
    ).toBe('empty');
  });

  it('falls back to the empty state with no scene, load or error', () => {
    expect(getLineageMapEmptyState({ loading: false, hasError: false })).toBe(
      'empty'
    );
  });
});
