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

import { EntityGraphExportFormat } from '../../rest/rdfAPI.interface';
import { ExportFormat } from '../OntologyExplorer/ExportGraphPanel.interface';

export const ENTITY_UUID_REGEX = /\/([a-f0-9-]{36})$/;
export const PANEL_WIDTH = 576;
export const FIT_SCALE_FACTOR = 0.9;
export const ZOOM_IN_FACTOR = 1.2;
export const ZOOM_OUT_FACTOR = 0.8;
export const ZOOM_DURATION_MS = 300;
export const ZOOM_EASING = 'easeCubic';

export const EXPORT_FORMAT_MAP: Partial<
  Record<ExportFormat, EntityGraphExportFormat>
> = {
  [ExportFormat.JSONLD]: 'jsonld',
  [ExportFormat.TURTLE]: 'turtle',
};

export const NODE_WIDTH = 280;
export const NODE_HEIGHT = 36;
export const MAX_NODE_WIDTH = 280;
export const MIN_NODE_WIDTH = 120;

export const EDGE_LINE_WIDTH = 1.75;
export const EDGE_HIGHLIGHT_LINE_WIDTH = 3;
export const EDGE_LABEL_FONT_SIZE = 11;
/**
 * Non-focused elements keep this much opacity while a path is highlighted, so
 * the surrounding graph stays as readable context instead of disappearing.
 */
export const DIMMED_OPACITY = 0.18;
export const EDGE_ARROW_SIZE = 10;
export const EDGE_HIGHLIGHT_ARROW_SIZE = 13;
/**
 * Perpendicular separation between the two edges of a bidirectional pair. G6
 * measures the offset along the direction of travel, so one positive value
 * bows each direction to its own side.
 */
export const BIDIRECTIONAL_CURVE_OFFSET = 60;

/**
 * Where an edge's label sits along its path, as a fraction from source to
 * target. Edges that share an endpoint spread their anchors across
 * [START, END] so their labels fan out along the corridor rather than stacking;
 * a lone edge uses SOLO, just off the crowded midpoint.
 */
export const LABEL_BAND_START = 0.22;
export const LABEL_BAND_END = 0.72;
export const LABEL_PLACEMENT_SOLO = 0.4;

/**
 * Upper bound on how far the radial ring may be stretched horizontally to match
 * a wide graph pane. Past this the ellipse gets thin enough that the spokes
 * near its ends run almost parallel and stop reading as separate directions.
 */
export const RING_STRETCH_MAX = 1.6;

/** Colour tokens for the node card, resolved against the live theme. */
export const NODE_NEUTRAL_COLOR = {
  token: 'var(--om-color-gray-400)',
  fallback: '#a4a7ae',
};

/**
 * Accent + background colour pair for one entity type, expressed as CSS custom
 * properties so the graph follows dark mode and custom branding, with concrete
 * fallbacks for canvas contexts where the token cannot be read.
 */
export interface EntityTypePalette {
  token: string;
  fallback: string;
  bgToken: string;
  bgFallback: string;
}

/**
 * Concrete value of each hue's `-50` background token. Only needed for the
 * fallback path; the `var()` reference is what actually renders.
 */
const HUE_BG_FALLBACK: Record<string, string> = {
  'blue-dark': '#eff4ff',
  'blue-light': '#f0f9ff',
  cyan: '#ecfdff',
  fuchsia: '#fdf4ff',
  'gray-blue': '#f8f9fc',
  green: '#edfcf2',
  indigo: '#eef4ff',
  orange: '#fff6ed',
  'orange-dark': '#fff4ed',
  pink: '#fdf2fa',
  purple: '#f4f3ff',
  rose: '#fff1f3',
  teal: '#f0fdf9',
  violet: '#f5f3ff',
  yellow: '#fefbe8',
};

/**
 * The accent takes the requested shade of a hue; the card background always
 * takes that hue's `-50`, which is what keeps chip and node visually paired.
 */
const palette = (
  hue: keyof typeof HUE_BG_FALLBACK,
  shade: number,
  fallback: string
): EntityTypePalette => ({
  token: `var(--om-color-${hue}-${shade})`,
  fallback,
  bgToken: `var(--om-color-${hue}-50)`,
  bgFallback: HUE_BG_FALLBACK[hue],
});

/**
 * Entity type → node accent colour. Explicit rather than hashed so the same
 * asset type always carries the same colour across graphs and matches the
 * legend. Keys are normalized by `normalizeEntityTypeKey`.
 */
export const ENTITY_TYPE_COLORS: Record<string, EntityTypePalette> = {
  table: palette('blue-dark', 500, '#2970ff'),
  column: palette('blue-light', 600, '#0086c9'),
  database: palette('indigo', 600, '#444ce7'),
  databaseschema: palette('indigo', 500, '#6172f3'),
  dashboard: palette('fuchsia', 600, '#ba24d5'),
  dashboarddatamodel: palette('fuchsia', 500, '#d444f1'),
  chart: palette('fuchsia', 700, '#9f1ab1'),
  pipeline: palette('violet', 600, '#7839ee'),
  topic: palette('cyan', 600, '#088ab2'),
  container: palette('yellow', 600, '#ca8504'),
  mlmodel: palette('orange', 600, '#ec4a0a'),
  searchindex: palette('cyan', 700, '#0e7090'),
  storedprocedure: palette('violet', 700, '#6927da'),
  glossaryterm: palette('purple', 600, '#6938ef'),
  glossary: palette('purple', 700, '#5925dc'),
  tag: palette('teal', 600, '#0e9384'),
  classification: palette('teal', 700, '#107569'),
  domain: palette('green', 600, '#099250'),
  dataproduct: palette('green', 700, '#087443'),
  user: palette('orange-dark', 600, '#e62e05'),
  team: palette('orange-dark', 700, '#bc1b06'),
  testcase: palette('pink', 600, '#dd2590'),
  testsuite: palette('pink', 700, '#c11574'),
  datacontract: palette('rose', 600, '#e31b54'),
  query: palette('gray-blue', 600, '#3e4784'),
};

/** Every `*Service` type shares one colour; matched by suffix. */
export const SERVICE_TYPE_COLOR = palette('gray-blue', 700, '#363f72');
