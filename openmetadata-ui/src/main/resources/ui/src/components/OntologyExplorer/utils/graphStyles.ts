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
import { Group, Rect as GRect, Text as GText } from '@antv/g';
import {
  ExtensionCategory,
  RectCombo,
  RectComboStyleProps,
  register,
} from '@antv/g6';
import {
  COMBO_FILL_DEFAULT,
  COMBO_HEADER_HEIGHT,
  COMBO_LABEL_FONT_SIZE,
  COMBO_LABEL_FONT_WEIGHT,
  COMBO_LABEL_PADDING_LEFT,
  COMBO_LABEL_PADDING_TOP_BOTTOM,
  COMBO_LINE_WIDTH,
  COMBO_PADDING,
  COMBO_RADIUS,
  DATA_MODE_ASSET_CIRCLE_SIZE,
  DATA_MODE_ASSET_FILL_OPACITY,
  DATA_MODE_ASSET_LABEL_FONT_SIZE,
  DATA_MODE_ASSET_LABEL_FONT_WEIGHT,
  DATA_MODE_ASSET_LINE_WIDTH,
  DATA_MODE_LABEL_OFFSET_Y,
  DATA_MODE_TERM_LABEL_BG_RADIUS,
  DATA_MODE_TERM_LABEL_FONT_WEIGHT,
  DATA_MODE_TERM_NODE_SIZE,
  DATA_MODE_TERM_RADIUS,
  EDGE_LABEL_BG_FILL,
  EDGE_LABEL_BG_RADIUS,
  EDGE_LABEL_BG_SHADOW_BLUR,
  EDGE_LABEL_BG_SHADOW_COLOR,
  EDGE_LABEL_BG_SHADOW_OFFSET_Y,
  EDGE_LABEL_BG_STROKE,
  EDGE_LABEL_FILL,
  EDGE_LABEL_FONT_FAMILY,
  EDGE_LABEL_FONT_SIZE,
  EDGE_LABEL_FONT_WEIGHT,
  EDGE_LABEL_LETTER_SPACING,
  EDGE_LABEL_LINE_HEIGHT,
  LABEL_TEXT_ALIGN_LEFT,
  NODE_BORDER_COLOR,
  NODE_BORDER_RADIUS,
  NODE_FILL_DEFAULT,
  NODE_LABEL_FILL,
  NODE_LABEL_FILL_FALLBACK,
  NODE_LABEL_FONT_SIZE,
  NODE_LABEL_FONT_WEIGHT,
  NODE_LABEL_PADDING,
  NODE_LINE_WIDTH,
  NODE_SHADOW_BLUR,
  NODE_SHADOW_COLOR,
  NODE_SHADOW_COLOR_FALLBACK,
  NODE_SHADOW_OFFSET_Y,
  RELATION_META,
  TERM_LABEL_BG_PADDING,
} from '../OntologyExplorer.constants';

const cssColorCache = new Map<string, string>();

function parseVarName(cssVar: string): string {
  const inner = cssVar.slice(4, -1).trim();
  const firstComma = inner.indexOf(',');

  return (firstComma > 0 ? inner.slice(0, firstComma) : inner).trim();
}

function isColorLike(val: string): boolean {
  return (
    val.length > 0 &&
    (val.startsWith('rgb') || val.startsWith('#') || val.startsWith('hsl'))
  );
}

/**
 * Resolves a theme CSS variable to a concrete color for Canvas (G6).
 * Reads from :root first so theme from theme.css is used; Canvas cannot resolve var().
 */
export function getCanvasColor(cssVar: string, fallbackHex: string): string {
  if (typeof document === 'undefined') {
    return fallbackHex;
  }

  if (!cssVar.startsWith('var(')) {
    return cssVar;
  }

  const cached = cssColorCache.get(cssVar);
  if (cached && cached !== fallbackHex) {
    return cached;
  }

  try {
    const varName = parseVarName(cssVar);
    const rootVal = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    if (rootVal && isColorLike(rootVal)) {
      cssColorCache.set(cssVar, rootVal);

      return rootVal;
    }

    const tempEl = document.createElement('div');
    tempEl.style.color = cssVar;
    tempEl.style.display = 'none';
    document.body.appendChild(tempEl);
    const val = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);

    if (val && val !== 'rgba(0, 0, 0, 0)' && isColorLike(val)) {
      cssColorCache.set(cssVar, val);

      return val;
    }
  } catch (e) {
    // Ignore
  }

  return fallbackHex;
}

export const LABEL_PLACEMENT_BOTTOM = 'bottom';
export const LABEL_PLACEMENT_CENTER = 'center';
export const LABEL_PLACEMENT_TOP_LEFT = 'top-left';

export class GlossaryCombo extends RectCombo {
  protected drawLabelShape(
    attributes: Required<RectComboStyleProps>,
    container: Group
  ): void {
    const keyShape = this.getShape('key');
    if (keyShape) {
      const bounds = keyShape.getLocalBounds();
      const comboWidth = bounds.max[0] - bounds.min[0];
      const color =
        typeof attributes.stroke === 'string' ? attributes.stroke : '#94a3b8';
      this.upsert(
        'header-bg',
        GRect,
        {
          x: bounds.min[0],
          y: bounds.min[1],
          width: comboWidth,
          height: COMBO_HEADER_HEIGHT,
          fill: color + '25',
          stroke: 'none',
          lineWidth: 0,
          radius: [10, 10, 0, 0],
        },
        container
      );

      const labelText = String(attributes.labelText ?? '');
      const labelFill =
        typeof attributes.labelFill === 'string' ? attributes.labelFill : color;
      const labelFontSize =
        typeof attributes.labelFontSize === 'number'
          ? attributes.labelFontSize
          : 12;
      let normalizedFontWeight: number = 500;
      const fontWeight = attributes.labelFontWeight;
      if (typeof fontWeight === 'number') {
        normalizedFontWeight = fontWeight;
      } else if (fontWeight === 'bold') {
        normalizedFontWeight = 700;
      }
      const x = bounds.min[0] + COMBO_LABEL_PADDING_LEFT;
      const y = bounds.min[1] + COMBO_HEADER_HEIGHT / 2;

      this.upsert(
        'combo-label',
        GText,
        {
          x,
          y,
          text: labelText,
          fill: labelFill,
          fontSize: labelFontSize,
          fontWeight: normalizedFontWeight,
          textBaseline: 'middle',
          textAlign: 'left',
        },
        container
      );
    }
  }
}
register(ExtensionCategory.COMBO, 'glossary-combo', GlossaryCombo);

export function formatRelationLabel(relationType: string): string {
  return relationType
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toUpperCase();
}

/** Keep relation label close to the edge so it reads as "on edge", not floating. */
const EDGE_LABEL_OFFSET_Y = -10;
/** Padding for edge label badge (matches relation badge in details panel). */
const EDGE_LABEL_BADGE_PADDING: [number, number, number, number] = [4, 7, 4, 7];
const EDGE_LABEL_BADGE_RADIUS = 6;
const EDGE_LABEL_BADGE_FONT_WEIGHT = 700;

export function getEdgeRelationLabelStyle(
  labelText: string,
  relationType?: string
): Record<string, unknown> {
  const meta =
    relationType != null
      ? RELATION_META[relationType] ?? RELATION_META.default
      : null;

  const edgeLabelPadding = meta
    ? EDGE_LABEL_BADGE_PADDING
    : ([8, 16, 8, 16] as const);

  return {
    labelText,
    labelPosition: 'center',
    labelBackground: true,
    labelBackgroundFill: meta
      ? meta.background
      : getCanvasColor(EDGE_LABEL_BG_FILL, '#EFF1F8'),
    labelBackgroundStroke: meta
      ? 'none'
      : getCanvasColor(EDGE_LABEL_BG_STROKE, '#FFF'),
    labelBackgroundLineWidth: meta ? 0 : 1,
    labelBackgroundRadius: meta
      ? EDGE_LABEL_BADGE_RADIUS
      : EDGE_LABEL_BG_RADIUS,
    labelBackgroundPadding: edgeLabelPadding,
    labelPadding: edgeLabelPadding,
    labelBackgroundShadowColor: meta
      ? 'transparent'
      : getCanvasColor(EDGE_LABEL_BG_SHADOW_COLOR, '#EBEDF5'),
    labelBackgroundShadowBlur: meta ? 0 : EDGE_LABEL_BG_SHADOW_BLUR,
    labelBackgroundShadowOffsetY: meta ? 0 : EDGE_LABEL_BG_SHADOW_OFFSET_Y,
    labelBackgroundShadowOffsetX: 0,
    labelFill: meta ? meta.color : getCanvasColor(EDGE_LABEL_FILL, '#8C93AE'),
    labelFontSize: EDGE_LABEL_FONT_SIZE,
    labelFontWeight: meta
      ? EDGE_LABEL_BADGE_FONT_WEIGHT
      : EDGE_LABEL_FONT_WEIGHT,
    labelFontFamily: EDGE_LABEL_FONT_FAMILY,
    labelLineHeight: EDGE_LABEL_LINE_HEIGHT,
    labelLetterSpacing: EDGE_LABEL_LETTER_SPACING,
    labelAutoRotate: false,
    labelOffsetY: EDGE_LABEL_OFFSET_Y,
    labelMaxWidth: 120,
  };
}

export interface NodeStylePosition {
  x: number;
  y: number;
}

export function buildDefaultRectNodeStyle(
  getColor: (cssVar: string, fallback: string) => string,
  label: string,
  size: [number, number],
  pos?: NodeStylePosition
): Record<string, unknown> {
  return {
    size,
    fill: NODE_FILL_DEFAULT,
    stroke: NODE_BORDER_COLOR,
    lineWidth: NODE_LINE_WIDTH,
    radius: NODE_BORDER_RADIUS,
    icon: false,
    labelText: label,
    labelFill: getColor(NODE_LABEL_FILL, NODE_LABEL_FILL_FALLBACK),
    labelFontSize: NODE_LABEL_FONT_SIZE,
    labelFontWeight: NODE_LABEL_FONT_WEIGHT,
    labelPlacement: LABEL_PLACEMENT_CENTER,
    labelPadding: NODE_LABEL_PADDING,
    shadowColor: getColor(NODE_SHADOW_COLOR, NODE_SHADOW_COLOR_FALLBACK),
    shadowBlur: NODE_SHADOW_BLUR,
    shadowOffsetY: NODE_SHADOW_OFFSET_Y,
    ...(pos && { x: pos.x, y: pos.y }),
  };
}

export function buildDataModeAssetNodeStyle(
  getColor: (cssVar: string, fallback: string) => string,
  label: string,
  assetColor: string,
  pos?: NodeStylePosition
): Record<string, unknown> {
  const sz = DATA_MODE_ASSET_CIRCLE_SIZE;
  const resolvedFill =
    getColor(assetColor, '#e2e8f0') + DATA_MODE_ASSET_FILL_OPACITY;
  const resolvedStroke = getColor(assetColor, '#e2e8f0');

  return {
    size: [sz, sz],
    fill: resolvedFill,
    stroke: resolvedStroke,
    lineWidth: DATA_MODE_ASSET_LINE_WIDTH,
    radius: sz / 2,
    icon: false,
    labelText: label,
    labelFill: getColor(NODE_LABEL_FILL, NODE_LABEL_FILL_FALLBACK),
    labelFontSize: DATA_MODE_ASSET_LABEL_FONT_SIZE,
    labelFontWeight: DATA_MODE_ASSET_LABEL_FONT_WEIGHT,
    labelPlacement: LABEL_PLACEMENT_BOTTOM,
    labelOffsetY: DATA_MODE_LABEL_OFFSET_Y,
    shadowColor: getColor(NODE_SHADOW_COLOR, NODE_SHADOW_COLOR_FALLBACK),
    shadowBlur: NODE_SHADOW_BLUR,
    shadowOffsetY: NODE_SHADOW_OFFSET_Y,
    ...(pos && { x: pos.x, y: pos.y }),
  };
}

export function buildDataModeTermNodeStyle(
  getColor: (cssVar: string, fallback: string) => string,
  label: string,
  color: string,
  pos?: NodeStylePosition
): Record<string, unknown> {
  const sz = DATA_MODE_TERM_NODE_SIZE;
  const resolvedColor = getColor(color, '#3b82f6');
  const resolvedWhite = getColor('var(--color-white)', '#ffffff');

  return {
    size: [sz, sz],
    fill: resolvedColor,
    stroke: 'none',
    lineWidth: 0,
    radius: DATA_MODE_TERM_RADIUS,
    icon: false,
    labelText: label,
    labelFill: resolvedWhite,
    labelFontSize: NODE_LABEL_FONT_SIZE,
    labelFontWeight: DATA_MODE_TERM_LABEL_FONT_WEIGHT,
    labelPlacement: LABEL_PLACEMENT_BOTTOM,
    labelOffsetY: DATA_MODE_LABEL_OFFSET_Y,
    labelBackground: true,
    labelBackgroundFill: resolvedColor,
    labelBackgroundStroke: 'none',
    labelBackgroundRadius: DATA_MODE_TERM_LABEL_BG_RADIUS,
    labelPadding: TERM_LABEL_BG_PADDING,
    shadowColor: getColor(NODE_SHADOW_COLOR, NODE_SHADOW_COLOR_FALLBACK),
    shadowBlur: NODE_SHADOW_BLUR,
    shadowOffsetY: NODE_SHADOW_OFFSET_Y,
    ...(pos && { x: pos.x, y: pos.y }),
  };
}

export function buildComboStyle(
  labelText: string,
  color: string
): Record<string, unknown> {
  return {
    fill: COMBO_FILL_DEFAULT,
    stroke: color,
    lineWidth: COMBO_LINE_WIDTH,
    radius: COMBO_RADIUS,
    padding: COMBO_PADDING,
    label: true,
    labelText,
    labelFill: color,
    labelFontSize: COMBO_LABEL_FONT_SIZE,
    labelFontWeight: COMBO_LABEL_FONT_WEIGHT,
    labelPlacement: LABEL_PLACEMENT_TOP_LEFT,
    labelOffsetX: COMBO_LABEL_PADDING_LEFT,
    labelOffsetY: COMBO_LABEL_PADDING_TOP_BOTTOM,
    labelTextAlign: LABEL_TEXT_ALIGN_LEFT,
  };
}
