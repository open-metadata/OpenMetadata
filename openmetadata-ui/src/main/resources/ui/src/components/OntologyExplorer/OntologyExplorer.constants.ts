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
  GlossaryTermRelationType,
  RelationCategory,
} from '../../generated/configuration/glossaryTermRelationSettings';

/** Synthetic id for the glossary/relation "All" option in ontology filter autocompletes */
export const ONTOLOGY_AUTOCOMPLETE_ALL_ID = '__all__';

/** Max parallel `getGlossaryTermsAssetCounts` calls when multiple glossaries are selected */
export const GLOSSARY_TERM_ASSET_COUNT_FETCH_CONCURRENCY = 4;

export const withoutOntologyAutocompleteAll = (ids: string[]): string[] =>
  ids.filter((id) => id !== ONTOLOGY_AUTOCOMPLETE_ALL_ID);

export const DEFAULT_GLOSSARY_TERM_RELATION_TYPES_FALLBACK: GlossaryTermRelationType[] =
  [
    {
      name: 'relatedTo',
      displayName: 'Related To',
      description: 'General associative relationship',
      isSymmetric: true,
      category: RelationCategory.Associative,
    },
  ];

export const RELATION_META: Record<
  string,
  { color: string; background: string; labelKey: string }
> = {
  relatedTo: {
    color: '#1570ef',
    background: '#eff8ff',
    labelKey: 'label.related-to',
  },
  related: {
    color: '#1570ef',
    background: '#eff8ff',
    labelKey: 'label.related',
  },
  synonym: {
    color: '#b42318',
    background: '#fef3f2',
    labelKey: 'label.synonym',
  },
  antonym: {
    color: '#b54708',
    background: '#fffaeb',
    labelKey: 'label.antonym',
  },
  typeOf: {
    color: '#067647',
    background: '#ecfdf3',
    labelKey: 'label.type-of',
  },
  hasTypes: {
    color: '#067647',
    background: '#ecfdf3',
    labelKey: 'label.has-types',
  },
  hasA: {
    color: '#026aa2',
    background: '#f0f9ff',
    labelKey: 'label.has-a',
  },
  partOf: {
    color: '#026aa2',
    background: '#f0f9ff',
    labelKey: 'label.part-of',
  },
  hasPart: {
    color: '#155eef',
    background: '#eff4ff',
    labelKey: 'label.has-part',
  },
  componentOf: {
    color: '#026aa2',
    background: '#f0f9ff',
    labelKey: 'label.component-of',
  },
  composedOf: {
    color: '#026aa2',
    background: '#f0f9ff',
    labelKey: 'label.composed-of',
  },
  calculatedFrom: {
    color: '#6938ef',
    background: '#f4f3ff',
    labelKey: 'label.calculated-from',
  },
  usedToCalculate: {
    color: '#ba24d5',
    background: '#fdf4ff',
    labelKey: 'label.used-to-calculate',
  },
  derivedFrom: {
    color: '#bc1b06',
    background: '#fff4ed',
    labelKey: 'label.derived-from',
  },
  seeAlso: {
    color: '#c11574',
    background: '#fdf2fa',
    labelKey: 'label.see-also',
  },
  parentOf: {
    color: '#1570ef',
    background: '#eff8ff',
    labelKey: 'label.parent-of',
  },
  childOf: {
    color: '#1570ef',
    background: '#eff8ff',
    labelKey: 'label.child-of',
  },
  broader: {
    color: '#067647',
    background: '#ecfdf3',
    labelKey: 'label.broader',
  },
  narrower: {
    color: '#4e5ba6',
    background: '#f8f9fc',
    labelKey: 'label.narrower',
  },
  isA: {
    color: '#067647',
    background: '#ecfdf3',
    labelKey: 'label.is-a',
  },
  instanceOf: {
    color: '#067647',
    background: '#ecfdf3',
    labelKey: 'label.instance-of',
  },
  owns: {
    color: '#6938ef',
    background: '#f4f3ff',
    labelKey: 'label.owns',
  },
  ownedBy: {
    color: '#6938ef',
    background: '#f4f3ff',
    labelKey: 'label.owned-by',
  },
  manages: {
    color: '#1570ef',
    background: '#eff8ff',
    labelKey: 'label.manages',
  },
  managedBy: {
    color: '#1570ef',
    background: '#eff8ff',
    labelKey: 'label.managed-by',
  },
  contains: {
    color: '#026aa2',
    background: '#f0f9ff',
    labelKey: 'label.contains',
  },
  containedIn: {
    color: '#026aa2',
    background: '#f0f9ff',
    labelKey: 'label.contained-in',
  },
  dependsOn: {
    color: '#b42318',
    background: '#fef3f2',
    labelKey: 'label.depends-on',
  },
  usedBy: {
    color: '#b54708',
    background: '#fffaeb',
    labelKey: 'label.used-by',
  },
  metricFor: {
    color: '#026aa2',
    background: '#f0f9ff',
    labelKey: 'label.metric-for',
  },
  hasGlossaryTerm: {
    color: '#107569',
    background: '#f0fdf9',
    labelKey: 'label.tagged-with',
  },
  custom1: {
    color: '#bc1b06',
    background: '#fff4ed',
    labelKey: 'label.color-orange',
  },
  custom2: {
    color: '#535862',
    background: '#fafafa',
    labelKey: 'label.color-gray',
  },
  custom6: {
    color: '#107569',
    background: '#f0fdf9',
    labelKey: 'label.color-rose',
  },
  custom4: {
    color: '#7839ee',
    background: '#f5f3ff',
    labelKey: 'label.color-teal',
  },
  custom5: {
    color: '#4f7a21',
    background: '#f5fbee',
    labelKey: 'label.color-moss',
  },
  custom7: {
    color: '#0e7090',
    background: '#ecfdff',
    labelKey: 'label.color-cyan',
  },
  custom3: {
    color: '#e31b54',
    background: '#fff1f3',
    labelKey: 'label.color-violet',
  },
  default: {
    color: '#535862',
    background: '#fafafa',
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
    color: '#1570ef',
    background: '#eff8ff',
    labelKey: 'label.color-blue',
  },
  '#b42318': {
    color: '#b42318',
    background: '#fef3f2',
    labelKey: 'label.color-red',
  },
  '#b54708': {
    color: '#b54708',
    background: '#fffaeb',
    labelKey: 'label.color-yellow',
  },
  '#067647': {
    color: '#067647',
    background: '#ecfdf3',
    labelKey: 'label.color-green',
  },
  '#4e5ba6': {
    color: '#4e5ba6',
    background: '#f8f9fc',
    labelKey: 'label.color-blue-gray',
  },
  '#026aa2': {
    color: '#026aa2',
    background: '#f0f9ff',
    labelKey: 'label.color-blue-light',
  },
  '#155eef': {
    color: '#155eef',
    background: '#eff4ff',
    labelKey: 'label.color-dark-blue',
  },
  '#6938ef': {
    color: '#6938ef',
    background: '#f4f3ff',
    labelKey: 'label.color-purple',
  },
  '#ba24d5': {
    color: '#ba24d5',
    background: '#fdf4ff',
    labelKey: 'label.color-fuchsia',
  },
  '#c11574': {
    color: '#c11574',
    background: '#fdf2fa',
    labelKey: 'label.color-pink',
  },
  '#bc1b06': {
    color: '#bc1b06',
    background: '#fff4ed',
    labelKey: 'label.color-orange',
  },
  '#107569': {
    color: '#107569',
    background: '#f0fdf9',
    labelKey: 'label.color-rose',
  },
  '#535862': {
    color: '#535862',
    background: '#fafafa',
    labelKey: 'label.color-gray',
  },
  '#e31b54': {
    color: '#e31b54',
    background: '#fff1f3',
    labelKey: 'label.color-violet',
  },
  '#7839ee': {
    color: '#7839ee',
    background: '#f5f3ff',
    labelKey: 'label.color-teal',
  },
  '#4f7a21': {
    color: '#4f7a21',
    background: '#f5fbee',
    labelKey: 'label.color-moss',
  },
  '#0e7090': {
    color: '#0e7090',
    background: '#ecfdff',
    labelKey: 'label.color-cyan',
  },
};

export const EDGE_STROKE_COLOR = '#9196B1';
export const DATA_MODE_ASSET_EDGE_STROKE_COLOR = '#D9DEED';
export const DIMMED_NODE_OPACITY = 0.35;
export const DIMMED_EDGE_OPACITY = 0.25;

export const NODE_FILL_DEFAULT = '#ffffff';
export const NODE_BORDER_COLOR = '#D5D9EB';
export const NODE_SELECTED_STROKE = '#1570ef';
export const NODE_SELECTED_LINE_WIDTH = 2.5;
export const NODE_SELECTED_HALO_LINE_WIDTH = 8;
export const NODE_SELECTED_HALO_FILL = 'rgba(21, 112, 239, 0.06)';
export const NODE_BORDER_RADIUS = 6;
export const NODE_PADDING_V = 9;
export const NODE_PADDING_H = 10;
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
export const NODE_LABEL_FILL = '#000000';
export const BRAND_BLUE_FALLBACK = '#3b82f6';
export const COMBO_COLOR_FALLBACK = '#94a3b8';
export const DATA_MODE_LOAD_MORE_BADGE_BG = '#155EEF';
export const NODE_LABEL_FONT_SIZE = 14;
export const NODE_LABEL_FONT_WEIGHT = 500;
export const NODE_SHADOW_COLOR = 'rgba(0, 0, 0, 0.12)';
export const NODE_SHADOW_BLUR = 8;
export const NODE_SHADOW_OFFSET_Y = 2;

export const EDGE_LABEL_FILL = '#8C93AE';
export const EDGE_LABEL_FONT_SIZE = 12;
export const EDGE_LABEL_FONT_WEIGHT = 600;
export const EDGE_LABEL_FONT_FAMILY = 'Inter';
export const EDGE_LABEL_LINE_HEIGHT = 16;
export const EDGE_LABEL_LETTER_SPACING = 0;
export const EDGE_LABEL_BG_FILL = '#EFF1F8';
export const EDGE_LABEL_BG_STROKE = NODE_FILL_DEFAULT;
export const EDGE_LABEL_BG_RADIUS = 3;
export const EDGE_LABEL_BG_SHADOW_COLOR = '#EBEDF5';
export const EDGE_LABEL_BG_SHADOW_BLUR = 10;
export const EDGE_LABEL_BG_SHADOW_OFFSET_Y = 2;
export const EDGE_LABEL_BG_PADDING: [number, number, number, number] = [
  2, 8, 2, 8,
];
export const TERM_LABEL_BG_PADDING: [number, number, number, number] = [
  8, 8, 8, 8,
];

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 3;
export const DEFAULT_ZOOM = 1;
export const FIT_VIEW_ZOOM_OUT = 0.9;
export const FIT_VIEW_ZOOM_OUT_DATA_MODE = 0.7;

export const DATA_MODE_ASSET_LOAD_PAGE_SIZE = 1000;
export const DATA_MODE_ASSET_CIRCLE_SIZE = 20;
export const DATA_MODE_ASSET_LABEL_FONT_SIZE = 12;
export const DATA_MODE_ASSET_LABEL_BOX_MIN_WIDTH = 0;
export const DATA_MODE_ASSET_NAME_MAX_TEXT_WIDTH_PX = 300;
export const DATA_MODE_ASSET_ROW_MAX_WIDTH = 720;
export const DATA_MODE_ENTITY_TYPE_PILL_MAX_TEXT_WIDTH_PX = 120;
export const DATA_MODE_ASSET_LABEL_BOX_RADIUS = 4;
export const DATA_MODE_ASSET_LABEL_BOX_PADDING: [
  number,
  number,
  number,
  number
] = [6, 10, 6, 10];
export const DATA_MODE_ASSET_LABEL_LAYOUT_STACK = 62;
/** Extra radial gap from term node center to the first asset ring (longer connector feel in data mode). */
export const DATA_MODE_TERM_TO_FIRST_RING_GAP = 168;
export const COMBO_HEADER_HEIGHT = 34;
export const COMBO_LABEL_PADDING_LEFT = 13;

export enum LayoutType {
  Hierarchical = 'hierarchical',
  Radial = 'radial',
  Circular = 'circular',
}

export enum LayoutEngine {
  Dagre = 'dagre',
  Radial = 'radial',
  Circular = 'circular',
}

export type LayoutEngineType = `${LayoutEngine}`;

export function toLayoutEngineType(layout: LayoutType): LayoutEngineType {
  if (layout === LayoutType.Hierarchical) {
    return LayoutEngine.Dagre;
  }

  return layout as LayoutEngineType;
}

export const COMBO_PADDING = 48;
export const COMBO_LABEL_PADDING_TOP_BOTTOM = 10;
export const DATA_MODE_TERM_NODE_SIZE = 30;

export const DATA_MODE_TERM_MIN_CENTER_SPACING = 600;
export const DATA_MODE_TERM_GROUP_LAYOUT_MIN_RADIUS = 200;
export const DATA_MODE_GLOSSARY_MACRO_HULL_GAP = 120;
export const DATA_MODE_TERM_NODE_STROKE_WIDTH = 2;
/** Outer soft ring behind the term circle (G6 halo), light gray like elevated selection. */
export const DATA_MODE_TERM_HALO_LINE_WIDTH = 5;
export const DATA_MODE_TERM_HALO_STROKE = '#e8ecf0';
export const DATA_MODE_TERM_HALO_STROKE_OPACITY = 0.72;
export const DATA_MODE_TERM_HALO_SHADOW_COLOR = 'rgba(203, 213, 225, 0.35)';
export const DATA_MODE_TERM_HALO_SHADOW_BLUR = 5;
export const DATA_MODE_TERM_NODE_SHADOW_COLOR = 'rgba(241, 245, 249, 0.92)';
export const DATA_MODE_TERM_NODE_SHADOW_BLUR = 16;
export const DATA_MODE_TERM_NODE_SHADOW_OFFSET_Y = 5;
export const DATA_MODE_TERM_LABEL_SHADOW_COLOR = 'rgba(226, 232, 240, 0.65)';
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

export const NODE_LINE_WIDTH = 1;
export const DATA_MODE_ASSET_LINE_WIDTH = 1.5;
export const DATA_MODE_LABEL_OFFSET_Y = 20;
export const DATA_MODE_TERM_LABEL_BG_RADIUS = 6;
export const DATA_MODE_TERM_LABEL_FONT_WEIGHT = 600;
export const DATA_MODE_ASSET_LABEL_FONT_WEIGHT = 500;
export const DATA_MODE_ASSET_NAME_ENTITY_GAP = 12;
export const DATA_MODE_ENTITY_PILL_ICON_SIZE = 14;
export const DATA_MODE_ENTITY_PILL_ICON_PAD_LEFT = 6;
export const DATA_MODE_ENTITY_PILL_ICON_GAP_AFTER = 1;
export const DATA_MODE_ASSET_CARD_INSET_H = 4;
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
export const NODE_SHADOW_COLOR_FALLBACK = 'rgba(0,0,0,0.12)';
export const LABEL_TEXT_ALIGN_LEFT = 'left';
