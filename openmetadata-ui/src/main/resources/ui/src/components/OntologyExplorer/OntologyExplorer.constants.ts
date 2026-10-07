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

import type { Graph } from '@antv/g6';
import {
  Category,
  Characteristic,
  PaletteKey,
  RelationshipType,
} from '../../generated/entity/data/relationshipType';

/** Synthetic id for the glossary/relation "All" option in ontology filter autocompletes */
export const ONTOLOGY_AUTOCOMPLETE_ALL_ID = '__all__';

/** Max parallel `getGlossaryTermsAssetCounts` calls when multiple glossaries are selected */
export const GLOSSARY_TERM_ASSET_COUNT_FETCH_CONCURRENCY = 4;

export const withoutOntologyAutocompleteAll = (ids: string[]): string[] =>
  ids.filter((id) => id !== ONTOLOGY_AUTOCOMPLETE_ALL_ID);

export const DEFAULT_RELATIONSHIP_TYPE: RelationshipType = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'relatedTo',
  fullyQualifiedName: 'relatedTo',
  displayName: 'Related To',
  description: 'General associative relationship',
  rdfPredicate: 'https://open-metadata.org/ontology/relatedTo',
  category: Category.Core,
  characteristics: [Characteristic.Symmetric],
  crossGlossaryAllowed: true,
  paletteKey: PaletteKey.Blue,
  systemDefined: true,
};

export const DEFAULT_GLOSSARY_TERM_RELATION_TYPES_FALLBACK = [
  DEFAULT_RELATIONSHIP_TYPE,
];

const RELATION_PALETTES = {
  brand: {
    color: 'var(--tw-color-utility-brand-700)',
    background: 'var(--tw-color-utility-brand-50)',
  },
  error: {
    color: 'var(--tw-color-utility-error-700)',
    background: 'var(--tw-color-utility-error-50)',
  },
  warning: {
    color: 'var(--tw-color-utility-warning-700)',
    background: 'var(--tw-color-utility-warning-50)',
  },
  success: {
    color: 'var(--tw-color-utility-success-700)',
    background: 'var(--tw-color-utility-success-50)',
  },
  'blue-light': {
    color: 'var(--tw-color-utility-blue-light-700)',
    background: 'var(--tw-color-utility-blue-light-50)',
  },
  blue: {
    color: 'var(--tw-color-utility-blue-700)',
    background: 'var(--tw-color-utility-blue-50)',
  },
  purple: {
    color: 'var(--tw-color-utility-purple-700)',
    background: 'var(--tw-color-utility-purple-50)',
  },
  fuchsia: {
    color: 'var(--tw-color-utility-fuchsia-700)',
    background: 'var(--tw-color-utility-fuchsia-50)',
  },
  orange: {
    color: 'var(--tw-color-utility-orange-700)',
    background: 'var(--tw-color-utility-orange-50)',
  },
  pink: {
    color: 'var(--tw-color-utility-pink-700)',
    background: 'var(--tw-color-utility-pink-50)',
  },
  'gray-blue': {
    color: 'var(--tw-color-utility-gray-blue-700)',
    background: 'var(--tw-color-utility-gray-blue-50)',
  },
  teal: {
    color: 'var(--tw-color-utility-teal-700)',
    background: 'var(--tw-color-utility-teal-50)',
  },
  gray: {
    color: 'var(--tw-color-utility-gray-700)',
    background: 'var(--tw-color-utility-gray-50)',
  },
  violet: {
    color: 'var(--tw-color-utility-violet-700)',
    background: 'var(--tw-color-utility-violet-50)',
  },
  moss: {
    color: 'var(--tw-color-utility-moss-700)',
    background: 'var(--tw-color-utility-moss-50)',
  },
  cyan: {
    color: 'var(--tw-color-utility-cyan-700)',
    background: 'var(--tw-color-utility-cyan-50)',
  },
  rose: {
    color: 'var(--tw-color-utility-rose-700)',
    background: 'var(--tw-color-utility-rose-50)',
  },
};

export const RELATION_META: Record<
  string,
  { color: string; background: string; labelKey: string }
> = {
  relatedTo: {
    ...RELATION_PALETTES['brand'],
    labelKey: 'label.related-to',
  },
  related: {
    ...RELATION_PALETTES['brand'],
    labelKey: 'label.related',
  },
  synonym: {
    ...RELATION_PALETTES['error'],
    labelKey: 'label.synonym',
  },
  antonym: {
    ...RELATION_PALETTES['warning'],
    labelKey: 'label.antonym',
  },
  typeOf: {
    ...RELATION_PALETTES['success'],
    labelKey: 'label.type-of',
  },
  hasTypes: {
    ...RELATION_PALETTES['success'],
    labelKey: 'label.has-types',
  },
  hasA: {
    ...RELATION_PALETTES['blue-light'],
    labelKey: 'label.has-a',
  },
  partOf: {
    ...RELATION_PALETTES['blue-light'],
    labelKey: 'label.part-of',
  },
  hasPart: {
    ...RELATION_PALETTES['blue'],
    labelKey: 'label.has-part',
  },
  componentOf: {
    ...RELATION_PALETTES['blue-light'],
    labelKey: 'label.component-of',
  },
  composedOf: {
    ...RELATION_PALETTES['blue-light'],
    labelKey: 'label.composed-of',
  },
  calculatedFrom: {
    ...RELATION_PALETTES['purple'],
    labelKey: 'label.calculated-from',
  },
  usedToCalculate: {
    ...RELATION_PALETTES['fuchsia'],
    labelKey: 'label.used-to-calculate',
  },
  derivedFrom: {
    ...RELATION_PALETTES['orange'],
    labelKey: 'label.derived-from',
  },
  seeAlso: {
    ...RELATION_PALETTES['pink'],
    labelKey: 'label.see-also',
  },
  parentOf: {
    ...RELATION_PALETTES['brand'],
    labelKey: 'label.parent-of',
  },
  childOf: {
    ...RELATION_PALETTES['brand'],
    labelKey: 'label.child-of',
  },
  broader: {
    ...RELATION_PALETTES['success'],
    labelKey: 'label.broader',
  },
  narrower: {
    ...RELATION_PALETTES['gray-blue'],
    labelKey: 'label.narrower',
  },
  isA: {
    ...RELATION_PALETTES['success'],
    labelKey: 'label.is-a',
  },
  instanceOf: {
    ...RELATION_PALETTES['success'],
    labelKey: 'label.instance-of',
  },
  owns: {
    ...RELATION_PALETTES['purple'],
    labelKey: 'label.owns',
  },
  ownedBy: {
    ...RELATION_PALETTES['purple'],
    labelKey: 'label.owned-by',
  },
  manages: {
    ...RELATION_PALETTES['brand'],
    labelKey: 'label.manages',
  },
  managedBy: {
    ...RELATION_PALETTES['brand'],
    labelKey: 'label.managed-by',
  },
  contains: {
    ...RELATION_PALETTES['blue-light'],
    labelKey: 'label.contains',
  },
  containedIn: {
    ...RELATION_PALETTES['blue-light'],
    labelKey: 'label.contained-in',
  },
  dependsOn: {
    ...RELATION_PALETTES['error'],
    labelKey: 'label.depends-on',
  },
  usedBy: {
    ...RELATION_PALETTES['warning'],
    labelKey: 'label.used-by',
  },
  metricFor: {
    ...RELATION_PALETTES['blue-light'],
    labelKey: 'label.metric-for',
  },
  hasGlossaryTerm: {
    ...RELATION_PALETTES['teal'],
    labelKey: 'label.tagged-with',
  },
  custom1: {
    ...RELATION_PALETTES['orange'],
    labelKey: 'label.color-orange',
  },
  custom2: {
    ...RELATION_PALETTES['gray'],
    labelKey: 'label.color-gray',
  },
  custom6: {
    ...RELATION_PALETTES['teal'],
    labelKey: 'label.color-rose',
  },
  custom4: {
    ...RELATION_PALETTES['violet'],
    labelKey: 'label.color-teal',
  },
  custom5: {
    ...RELATION_PALETTES['moss'],
    labelKey: 'label.color-moss',
  },
  custom7: {
    ...RELATION_PALETTES['cyan'],
    labelKey: 'label.color-cyan',
  },
  custom3: {
    ...RELATION_PALETTES['rose'],
    labelKey: 'label.color-violet',
  },
  default: {
    ...RELATION_PALETTES['gray'],
    labelKey: 'label.relation-type',
  },
};

export const RELATION_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(RELATION_META).map(([key, { color }]) => [key, color])
);

export const COLOR_META_BY_HEX: Record<
  string,
  { color: string; background: string; labelKey: string }
> = {
  '#1570ef': {
    ...RELATION_PALETTES['brand'],
    labelKey: 'label.color-blue',
  },
  '#b42318': {
    ...RELATION_PALETTES['error'],
    labelKey: 'label.color-red',
  },
  '#b54708': {
    ...RELATION_PALETTES['warning'],
    labelKey: 'label.color-yellow',
  },
  '#067647': {
    ...RELATION_PALETTES['success'],
    labelKey: 'label.color-green',
  },
  '#4e5ba6': {
    ...RELATION_PALETTES['gray-blue'],
    labelKey: 'label.color-blue-gray',
  },
  '#026aa2': {
    ...RELATION_PALETTES['blue-light'],
    labelKey: 'label.color-blue-light',
  },
  '#155eef': {
    ...RELATION_PALETTES['blue'],
    labelKey: 'label.color-dark-blue',
  },
  '#6938ef': {
    ...RELATION_PALETTES['purple'],
    labelKey: 'label.color-purple',
  },
  '#ba24d5': {
    ...RELATION_PALETTES['fuchsia'],
    labelKey: 'label.color-fuchsia',
  },
  '#c11574': {
    ...RELATION_PALETTES['pink'],
    labelKey: 'label.color-pink',
  },
  '#bc1b06': {
    ...RELATION_PALETTES['orange'],
    labelKey: 'label.color-orange',
  },
  '#107569': {
    ...RELATION_PALETTES['teal'],
    labelKey: 'label.color-rose',
  },
  '#535862': {
    ...RELATION_PALETTES['gray'],
    labelKey: 'label.color-gray',
  },
  '#e31b54': {
    ...RELATION_PALETTES['rose'],
    labelKey: 'label.color-violet',
  },
  '#7839ee': {
    ...RELATION_PALETTES['violet'],
    labelKey: 'label.color-teal',
  },
  '#4f7a21': {
    ...RELATION_PALETTES['moss'],
    labelKey: 'label.color-moss',
  },
  '#0e7090': {
    ...RELATION_PALETTES['cyan'],
    labelKey: 'label.color-cyan',
  },
};

// Persisted palettes use hex keys, while built-in relations now supply theme tokens.
// Both forms must find the same badge background and palette metadata.
for (const meta of Object.values(COLOR_META_BY_HEX)) {
  COLOR_META_BY_HEX[meta.color] = meta;
}

const BORDER_PRIMARY_TOKEN = 'var(--tw-color-border-primary)';
const BORDER_PRIMARY_FALLBACK = '#D5D7DA';
const BORDER_SECONDARY_TOKEN = 'var(--tw-color-border-secondary)';

export const EDGE_STROKE_COLOR = BORDER_PRIMARY_TOKEN;
// SVG presentation attributes do not resolve CSS variables, so DOM-drawn
// edges resolve the token first and fall back to this.
export const EDGE_STROKE_COLOR_FALLBACK = BORDER_PRIMARY_FALLBACK;
export const DATA_MODE_ASSET_EDGE_STROKE_COLOR = BORDER_SECONDARY_TOKEN;
export const DIMMED_NODE_OPACITY = 0.32;
export const DIMMED_EDGE_OPACITY = 0.12;
export const DIMMED_EDGE_LABEL_OPACITY = 0.16;

export const NODE_FILL_DEFAULT = 'var(--tw-color-bg-primary)';
export const NODE_BORDER_COLOR = BORDER_SECONDARY_TOKEN;
export const NODE_SELECTED_STROKE = 'var(--tw-color-border-brand)';
export const NODE_SELECTED_LINE_WIDTH = 2.5;
export const NODE_SELECTED_HALO_LINE_WIDTH = 4;
export const NODE_SELECTED_HALO_FILL = 'var(--tw-color-bg-brand-primary)';
export const NODE_BORDER_RADIUS = 9;
export const NODE_PADDING_V = 9;
export const NODE_PADDING_H = 12;
/** Node label padding [top, right, bottom, left] – 12px top/bottom, 6px left/right. */
export const NODE_LABEL_PADDING: [number, number, number, number] = [
  NODE_PADDING_V,
  NODE_PADDING_H,
  NODE_PADDING_V,
  NODE_PADDING_H,
];
export const COMBO_FILL_DEFAULT = NODE_FILL_DEFAULT;
export const COMBO_BODY_FILL_OPACITY = '22';
export const COMBO_LABEL_BG_OPACITY = '40';
export const NODE_LABEL_FILL = 'var(--tw-color-text-primary)';
export const NODE_LABEL_FILL_INVERSE = 'var(--tw-color-text-white)';
export const BRAND_BLUE_FALLBACK = '#3b82f6';
export const COMBO_COLOR_FALLBACK = '#94a3b8';
export const DATA_MODE_ASSET_COUNT_BADGE_BG =
  'var(--tw-color-bg-primary-solid)';
export const DATA_MODE_LOAD_MORE_BADGE_BG = 'var(--tw-color-bg-brand-solid)';
export const NODE_LABEL_FONT_SIZE = 11;
export const NODE_LABEL_FONT_WEIGHT = 600;
export const NODE_SHADOW_COLOR = BORDER_SECONDARY_TOKEN;
export const NODE_SHADOW_BLUR = 2;
export const NODE_SHADOW_OFFSET_Y = 1;

export const EDGE_LABEL_FILL = 'var(--tw-color-text-tertiary)';
export const EDGE_LABEL_FONT_SIZE = 10;
export const EDGE_LABEL_FONT_WEIGHT = 600;
export const EDGE_LABEL_FONT_FAMILY = 'Inter';
export const EDGE_LABEL_LINE_HEIGHT = 16;
export const EDGE_LABEL_LETTER_SPACING = 0;
export const EDGE_LABEL_BG_FILL = 'var(--tw-color-bg-secondary)';
export const EDGE_LABEL_BG_STROKE = NODE_FILL_DEFAULT;
export const EDGE_LABEL_BG_RADIUS = 3;
export const EDGE_LABEL_BG_SHADOW_COLOR = BORDER_SECONDARY_TOKEN;
export const EDGE_LABEL_BG_SHADOW_BLUR = 10;
export const EDGE_LABEL_BG_SHADOW_OFFSET_Y = 2;
export const EDGE_LABEL_BG_PADDING: [number, number, number, number] = [
  2, 8, 2, 8,
];
export const TERM_LABEL_BG_PADDING: [number, number, number, number] = [
  8, 8, 8, 8,
];

export const MIN_ZOOM = 0.001;
export const MAX_ZOOM = 3;
export const DEFAULT_ZOOM = 1;
export const FIT_VIEW_ZOOM_OUT = 0.95;
export const FIT_VIEW_ZOOM_OUT_DATA_MODE = 0.85;
export const ONTOLOGY_FIT_VIEW_PADDING = 40;
export const ONTOLOGY_LARGE_GRAPH_NODE_COUNT = 1500;
export const ONTOLOGY_TERMS_PAGE_SIZE = 300;
export const ONTOLOGY_HEALTH_PREVIEW_SIZE = 5;
export const DATA_MODE_MAX_RENDER_COUNT = 60;
export const DATA_MODE_SEED_PAGE_SIZE = 12;
export const DATA_MODE_ASSET_PREVIEW_SIZE = 4;
export const DATA_MODE_CONNECTED_TERM_LIMIT = 48;
export const DATA_MODE_EDGE_LIMIT = 100;
export const PRACTICAL_MIN_ZOOM = 0.15;
export const PRACTICAL_MAX_ZOOM_INITIAL = 1;

export async function fitViewWithMinZoom(
  graph: Graph,
  duration = 0
): Promise<void> {
  await graph.fitView({ when: 'always', direction: 'both' }, { duration });
  const zoom = graph.getZoom();
  if (zoom > PRACTICAL_MAX_ZOOM_INITIAL) {
    graph.zoomTo(
      PRACTICAL_MAX_ZOOM_INITIAL,
      { duration: 0 },
      graph.getCanvasCenter()
    );
  }
}

export const DATA_MODE_ASSET_LOAD_PAGE_SIZE = 6;
/** Max assets a single "Load more" click pulls into a card (matches the backend @Max). */
export const DATA_MODE_ASSET_MAX_LOAD = 100;
export const DATA_MODE_ASSET_CIRCLE_SIZE = 20;

export const DATA_MODE_ASSET_LABEL_FONT_SIZE = 12;
export const DATA_MODE_ASSET_LABEL_BOX_MIN_WIDTH = 0;
export const DATA_MODE_ASSET_NAME_MAX_TEXT_WIDTH_PX = 220;
export const DATA_MODE_ASSET_ROW_MAX_WIDTH = 720;
export const DATA_MODE_ENTITY_TYPE_PILL_MAX_TEXT_WIDTH_PX = 200;
export const DATA_MODE_ASSET_LABEL_BOX_RADIUS = 4;
export const DATA_MODE_ASSET_LABEL_BOX_PADDING: [
  number,
  number,
  number,
  number
] = [6, 10, 6, 10];
export const DATA_MODE_ASSET_LABEL_LAYOUT_STACK = 62;
export const DATA_MODE_TERM_TO_FIRST_RING_GAP = 120;
export const COMBO_HEADER_HEIGHT = 34;
export const COMBO_INTERIOR_PADDING_TOP = COMBO_HEADER_HEIGHT + 10;
export const COMBO_INTERIOR_PADDING_SIDES = 12;
export const COMBO_LABEL_PADDING_LEFT = 13;
export const MODEL_ANTV_DAGRE_RANKSEP_WITH_COMBOS = 100;

export enum LayoutType {
  Hierarchical = 'hierarchical',
  Circular = 'circular',
}

export enum LayoutEngine {
  Dagre = 'dagre',
  Circular = 'circular',
}

export type LayoutEngineType = `${LayoutEngine}`;

export function toLayoutEngineType(layout: LayoutType): LayoutEngineType {
  if (layout === LayoutType.Hierarchical) {
    return LayoutEngine.Dagre;
  }

  return layout as LayoutEngineType;
}

export const COMBO_LABEL_PADDING_TOP_BOTTOM = 10;
export const DATA_MODE_TERM_NODE_SIZE = 30;
export const DATA_MODE_TERM_H_SPACING = 480;
export const DATA_MODE_TERM_V_SPACING = 160;
export const DATA_MODE_TERM_NODE_STROKE_WIDTH = 2;
/** Keep the term halo aligned with the active theme's elevated borders. */
export const DATA_MODE_TERM_HALO_LINE_WIDTH = 5;
export const DATA_MODE_TERM_HALO_STROKE = BORDER_SECONDARY_TOKEN;
export const DATA_MODE_TERM_HALO_STROKE_OPACITY = 0.72;
export const DATA_MODE_TERM_HALO_SHADOW_COLOR = BORDER_SECONDARY_TOKEN;
export const DATA_MODE_TERM_HALO_SHADOW_BLUR = 5;
export const DATA_MODE_TERM_NODE_SHADOW_COLOR = BORDER_PRIMARY_TOKEN;
export const DATA_MODE_TERM_NODE_SHADOW_BLUR = 16;
export const DATA_MODE_TERM_NODE_SHADOW_OFFSET_Y = 5;
export const DATA_MODE_TERM_LABEL_SHADOW_COLOR = BORDER_SECONDARY_TOKEN;
export const DATA_MODE_TERM_LABEL_SHADOW_BLUR = 14;
export const DATA_MODE_TERM_LABEL_SHADOW_OFFSET_Y = 4;
export const NODE_BADGE_OFFSET_X = 8;
export const NODE_BADGE_OFFSET_Y = -8;
export const DATA_MODE_TERM_ASSET_COUNT_BADGE_PADDING: [
  number,
  number,
  number,
  number
] = [5, 7, 5, 7];
export const DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER = 24;
export const DATA_MODE_TERM_ASSET_COUNT_BADGE_DIAMETER_WIDE = 28;
export const DATA_MODE_TERM_ASSET_COUNT_BADGE_WIDTH_CHAR = 7;
export const DATA_MODE_TERM_ASSET_COUNT_BADGE_WIDTH_MIN = 12;
export const HIERARCHY_BADGE_OFFSET_X = 0;
export const HIERARCHY_BADGE_OFFSET_Y = -18;
export const HIERARCHY_BADGE_TEXT_INSET = 16;

export const NODE_LINE_WIDTH = 1.5;
export const DATA_MODE_ASSET_LINE_WIDTH = 1.5;
export const DATA_MODE_LABEL_OFFSET_Y = 20;
export const DATA_MODE_TERM_LABEL_BG_RADIUS = 6;
export const DATA_MODE_TERM_LABEL_FONT_WEIGHT = 600;
export const DATA_MODE_ASSET_LABEL_FONT_WEIGHT = 500;
export const DATA_MODE_ASSET_NAME_ENTITY_GAP = 20;
export const DATA_MODE_ENTITY_PILL_ICON_SIZE = 14;
export const DATA_MODE_ENTITY_PILL_ICON_PAD_LEFT = 6;
export const DATA_MODE_ENTITY_PILL_ICON_GAP_AFTER = 1;
export const DATA_MODE_ASSET_CARD_INSET_H = 8;
export const DATA_MODE_ASSET_CARD_CLEAR_BELOW_CIRCLE = 20;
export const DATA_MODE_ASSET_BADGE_Z_INDEX = -1;
export const DATA_MODE_ENTITY_BADGE_BORDER_FALLBACK = '#D5D7DA';
export const DATA_MODE_ENTITY_BADGE_FONT_SIZE = 10;
export const DATA_MODE_ENTITY_BADGE_VERTICAL_NUDGE_UP = 6;
export const DATA_MODE_ENTITY_PILL_ICON_NUDGE_UP = 7;
export const DATA_MODE_ENTITY_PILL_TRIM_RIGHT_PX = 0;
export const COMBO_LINE_WIDTH = 0.8;
export const COMBO_RADIUS = 10;
export const COMBO_LABEL_FONT_SIZE = 12;
export const COMBO_LABEL_FONT_WEIGHT = 600;
export const EDGE_LINE_APPEND_WIDTH = 12;
export const EDGE_LINE_WIDTH_DEFAULT = 1.5;
export const EDGE_LINE_WIDTH_HIGHLIGHTED = 2.5;
export const NODE_LABEL_FILL_FALLBACK = '#1e293b';
// A metric node is a governed Metric entity drawn next to the concept it
// measures, not a concept: muted and dashed so it never reads as authorable.
export const STUDIO_METRIC_NODE_KIND = 'metric';
export const METRIC_NODE_FILL = 'var(--tw-color-bg-secondary)';
export const METRIC_NODE_FILL_FALLBACK = '#FAFAFA';
export const METRIC_NODE_STROKE = BORDER_PRIMARY_TOKEN;
export const METRIC_NODE_STROKE_FALLBACK = BORDER_PRIMARY_FALLBACK;
export const METRIC_NODE_MUTED_COLOR = 'var(--tw-color-text-tertiary)';
export const METRIC_NODE_MUTED_COLOR_FALLBACK = '#535862';
export const METRIC_NODE_LINE_DASH = [4, 3];
export const NODE_SHADOW_COLOR_FALLBACK = 'rgba(0,0,0,0.12)';
export const LABEL_TEXT_ALIGN_LEFT = 'left';
