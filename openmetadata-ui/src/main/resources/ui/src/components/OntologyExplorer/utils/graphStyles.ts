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
    register
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
    DATA_MODE_ASSET_LABEL_BOX_MAX_WIDTH,
    DATA_MODE_ASSET_LABEL_BOX_MIN_WIDTH,
    DATA_MODE_ASSET_LABEL_BOX_PADDING,
    DATA_MODE_ASSET_LABEL_BOX_RADIUS,
    DATA_MODE_ASSET_LABEL_FONT_SIZE,
    DATA_MODE_ASSET_LABEL_FONT_WEIGHT,
    DATA_MODE_ASSET_LINE_WIDTH,
    DATA_MODE_LABEL_OFFSET_Y,
    DATA_MODE_TERM_HALO_LINE_WIDTH,
    DATA_MODE_TERM_HALO_STROKE,
    DATA_MODE_TERM_HALO_STROKE_OPACITY,
    DATA_MODE_TERM_LABEL_BG_RADIUS,
    DATA_MODE_TERM_LABEL_FONT_WEIGHT,
    DATA_MODE_TERM_LABEL_SHADOW_BLUR,
    DATA_MODE_TERM_LABEL_SHADOW_COLOR,
    DATA_MODE_TERM_LABEL_SHADOW_OFFSET_Y,
    DATA_MODE_TERM_NODE_SHADOW_BLUR,
    DATA_MODE_TERM_NODE_SHADOW_COLOR,
    DATA_MODE_TERM_NODE_SHADOW_OFFSET_Y,
    DATA_MODE_TERM_NODE_SIZE,
    DATA_MODE_TERM_NODE_STROKE_WIDTH,
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
    TERM_LABEL_BG_PADDING
} from '../OntologyExplorer.constants';

const cssColorCache = new Map<string, string>();
const COMBO_LABEL_CHAR_WIDTH = 7;

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
 * Resolves a color for Canvas/WebGL (G6): pass-through hex/rgb strings, or resolve `var(--token)`
 * to a concrete `rgb(...)` / `rgba(...)` value. G6 cannot paint raw `var()` in canvas backends.
 *
 * `:root` getPropertyValue often returns another `var()`, `oklch()`, etc., which fails `isColorLike`,
 * so we probe with a temporary element first (browser computes to rgb).
 */
export function getCanvasColor(cssVar: string, fallbackHex: string): string {
  if (typeof document === 'undefined') {
    return fallbackHex;
  }

  if (!cssVar.startsWith('var(')) {
    return cssVar;
  }

  const cached = cssColorCache.get(cssVar);
  if (cached) {
    return cached;
  }

  try {
    const tempEl = document.createElement('div');
    tempEl.style.color = cssVar;
    tempEl.style.display = 'none';
    document.body.appendChild(tempEl);
    const fromCascade = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);

    if (
      fromCascade &&
      fromCascade !== 'rgba(0, 0, 0, 0)' &&
      isColorLike(fromCascade)
    ) {
      cssColorCache.set(cssVar, fromCascade);

      return fromCascade;
    }

    const varName = parseVarName(cssVar);
    const rootVal = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    if (rootVal && isColorLike(rootVal)) {
      cssColorCache.set(cssVar, rootVal);

      return rootVal;
    }
  } catch {
    // Ignore
  }

  return fallbackHex;
}

const GLOSSARY_HEADER_MIX_ACCENT = 0.11;

function parseColorToRgbTriplet(val: string): [number, number, number] | null {
  const v = val.trim();
  const hex = v.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const h = hex[1];

    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgbSp = v.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (rgbSp) {
    return [Number(rgbSp[1]), Number(rgbSp[2]), Number(rgbSp[3])];
  }
  const rgbComma = v.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (rgbComma) {
    return [Number(rgbComma[1]), Number(rgbComma[2]), Number(rgbComma[3])];
  }

  return null;
}

function mixAccentLikeScale50(rgb: [number, number, number]): string {
  const t = GLOSSARY_HEADER_MIX_ACCENT;
  const clamp = (n: number) => Math.min(255, Math.max(0, n));
  const r = clamp(Math.round(rgb[0] * t + 255 * (1 - t)));
  const g = clamp(Math.round(rgb[1] * t + 255 * (1 - t)));
  const b = clamp(Math.round(rgb[2] * t + 255 * (1 - t)));
  const x = (n: number) => n.toString(16).padStart(2, '0');

  return `#${x(r)}${x(g)}${x(b)}`;
}

/**
 * Glossary combo header: light "50" wash matching the glossary accent (title + border stroke).
 * For `var(--color-*-scale)` strokes, resolves `var(--color-*-50)`. For hex palette strokes, blends toward white.
 */
export function glossaryComboHeaderFill(stroke: string): string {
  const blendTowardWhite = (): string => {
    const resolved = stroke.startsWith('var(')
      ? getCanvasColor(stroke, '#94a3b8')
      : stroke;
    const rgb = parseColorToRgbTriplet(resolved);

    return rgb ? mixAccentLikeScale50(rgb) : '#f8fafc';
  };

  if (stroke.startsWith('var(')) {
    const m = stroke.match(/^var\((--color-[a-z0-9-]+)-\d{2,3}\)$/i);
    if (m) {
      return getCanvasColor(`var(${m[1]}-50)`, blendTowardWhite());
    }
  }

  return blendTowardWhite();
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
      const lw =
        typeof attributes.lineWidth === 'number'
          ? attributes.lineWidth
          : COMBO_LINE_WIDTH;
      const inset = lw / 2;
      const headerX = bounds.min[0] + inset;
      const headerY = bounds.min[1] + inset;
      const headerW = Math.max(0, comboWidth - 2 * inset);
      const headerH = Math.max(0, COMBO_HEADER_HEIGHT - inset);
      const topRadius = Math.max(0, COMBO_RADIUS - inset);
      this.upsert(
        'header-bg',
        GRect,
        {
          x: headerX,
          y: headerY,
          width: headerW,
          height: headerH,
          fill: glossaryComboHeaderFill(color),
          stroke: 'none',
          lineWidth: 0,
          radius: [topRadius, topRadius, 0, 0],
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
      const x = headerX + COMBO_LABEL_PADDING_LEFT;
      const y = headerY + headerH / 2;
      const maxLabelWidth = Math.max(
        16,
        headerW - COMBO_LABEL_PADDING_LEFT * 2
      );
      const maxChars = Math.max(
        1,
        Math.floor(maxLabelWidth / COMBO_LABEL_CHAR_WIDTH)
      );
      const truncatedLabelText =
        labelText.length > maxChars
          ? `${labelText.slice(0, Math.max(1, maxChars - 1))}...`
          : labelText;

      this.upsert(
        'combo-label',
        GText,
        {
          x,
          y,
          text: truncatedLabelText,
          fill: labelFill,
          fontSize: labelFontSize,
          fontWeight: COMBO_LABEL_FONT_WEIGHT,
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

export function truncateHierarchyBadgeToFitWidth(
  text: string,
  maxContentWidthPx: number,
  fontSize: number
): string {
  const t = text.trim();
  if (t.length === 0) {
    return t;
  }
  const w = Math.max(12, maxContentWidthPx);
  const avgCharPx = Math.max(5.5, fontSize * 0.65);
  const maxChars = Math.max(4, Math.floor(w / avgCharPx));
  if (t.length <= maxChars) {
    return t;
  }
  if (maxChars <= 1) {
    return '\u2026';
  }

  return `${t.slice(0, maxChars - 1)}\u2026`;
}

/** Perpendicular offset from edge — keep 0 so the label box stays vertically balanced. */
const EDGE_LABEL_OFFSET_Y = 0;
const EDGE_LABEL_BADGE_PADDING: [number, number, number, number] = [6, 8, 0, 8];
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

  const edgeLabelPadding = EDGE_LABEL_BADGE_PADDING;

  return {
    labelText,
    labelPosition: 'center',
    labelTextBaseline: 'middle',
    labelBackground: true,
    labelBackgroundOpacity: 1,
    labelBackgroundFill: meta
      ? getCanvasColor(meta.background, '#fafafa')
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
    labelFill: meta
      ? getCanvasColor(meta.color, '#717680')
      : getCanvasColor(EDGE_LABEL_FILL, '#8C93AE'),
    labelFontSize: EDGE_LABEL_FONT_SIZE,
    labelFontWeight: meta
      ? EDGE_LABEL_BADGE_FONT_WEIGHT
      : EDGE_LABEL_FONT_WEIGHT,
    labelFontFamily: EDGE_LABEL_FONT_FAMILY,
    labelLineHeight: EDGE_LABEL_FONT_SIZE,
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

const DATA_MODE_ASSET_LABEL_CHAR_WIDTH_EST = 6.5;

export function buildDataModeAssetNodeStyle(
  getColor: (cssVar: string, fallback: string) => string,
  label: string,
  assetColor: string,
  pos?: NodeStylePosition
): Record<string, unknown> {
  const sz = DATA_MODE_ASSET_CIRCLE_SIZE;
  const resolvedStroke = getColor(assetColor, '#e2e8f0');
  const pad = DATA_MODE_ASSET_LABEL_BOX_PADDING;
  const hPad = pad[1] + pad[3];
  const vPad = pad[0] + pad[2];
  const contentW = Math.ceil(
    label.length * DATA_MODE_ASSET_LABEL_CHAR_WIDTH_EST
  );
  const padded = contentW + hPad;
  const boxW = Math.min(
    DATA_MODE_ASSET_LABEL_BOX_MAX_WIDTH,
    Math.max(DATA_MODE_ASSET_LABEL_BOX_MIN_WIDTH, padded)
  );
  const maxTextW = Math.max(12, boxW - hPad);
  const boxH = DATA_MODE_ASSET_LABEL_FONT_SIZE + vPad + 4;

  return {
    size: [sz, sz],
    fill: EDGE_LABEL_BG_STROKE,
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
    labelTextAlign: 'center',
    labelWordWrap: true,
    labelMaxWidth: maxTextW,
    labelMaxLines: 1,
    labelTextOverflow: '...',
    labelBackground: true,
    labelBackgroundFill: EDGE_LABEL_BG_STROKE,
    labelBackgroundStroke: NODE_BORDER_COLOR,
    labelBackgroundLineWidth: 1,
    labelBackgroundRadius: DATA_MODE_ASSET_LABEL_BOX_RADIUS,
    labelBackgroundWidth: boxW,
    labelBackgroundHeight: boxH,
    labelPadding: pad,
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
  const resolvedColor = getColor(color, '#3b82f6');

  return {
    size: [DATA_MODE_TERM_NODE_SIZE, DATA_MODE_TERM_NODE_SIZE],
    fill: resolvedColor,
    stroke: NODE_FILL_DEFAULT,
    lineWidth: DATA_MODE_TERM_NODE_STROKE_WIDTH,
    strokeOpacity: 1,
    halo: true,
    haloLineWidth: DATA_MODE_TERM_HALO_LINE_WIDTH,
    haloStroke: DATA_MODE_TERM_HALO_STROKE,
    haloStrokeOpacity: DATA_MODE_TERM_HALO_STROKE_OPACITY,
    haloFill: 'rgba(255, 255, 255, 0)',
    haloFillOpacity: 0,
    icon: false,
    labelText: label,
    labelFill: NODE_FILL_DEFAULT,
    labelFontSize: NODE_LABEL_FONT_SIZE,
    labelFontWeight: DATA_MODE_TERM_LABEL_FONT_WEIGHT,
    labelPlacement: LABEL_PLACEMENT_BOTTOM,
    labelOffsetY: DATA_MODE_LABEL_OFFSET_Y,
    labelBackground: true,
    labelBackgroundFill: resolvedColor,
    labelBackgroundOpacity: 1,
    labelBackgroundStroke: NODE_FILL_DEFAULT,
    labelBackgroundLineWidth: DATA_MODE_TERM_NODE_STROKE_WIDTH,
    labelBackgroundRadius: DATA_MODE_TERM_LABEL_BG_RADIUS,
    labelBackgroundShadowColor: DATA_MODE_TERM_LABEL_SHADOW_COLOR,
    labelBackgroundShadowBlur: DATA_MODE_TERM_LABEL_SHADOW_BLUR,
    labelBackgroundShadowOffsetY: DATA_MODE_TERM_LABEL_SHADOW_OFFSET_Y,
    labelPadding: TERM_LABEL_BG_PADDING,
    shadowColor: DATA_MODE_TERM_NODE_SHADOW_COLOR,
    shadowBlur: DATA_MODE_TERM_NODE_SHADOW_BLUR,
    shadowOffsetY: DATA_MODE_TERM_NODE_SHADOW_OFFSET_Y,
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
