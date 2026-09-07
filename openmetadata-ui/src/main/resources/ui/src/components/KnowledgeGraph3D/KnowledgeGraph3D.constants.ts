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

import { Level, NodeType } from './types';

const BRAND_500_COLOR = 'var(--color-brand-500, #2E90FA)';
const PURPLE_500_COLOR = 'var(--color-purple-500, #7A5AF8)';

/**
 * Canvas and WebGL cannot consume CSS variables directly. Keep token references
 * here with concrete fallbacks, then resolve them at the paint boundary so
 * theme and brand overrides still reach the 3D scene.
 */
export const ENTITY_COLORS: Record<string, string> = {
  domain: PURPLE_500_COLOR,
  product: 'var(--color-success-500, #17B26A)',
  table: BRAND_500_COLOR,
  column: 'var(--color-brand-400, #53B1FD)',
  database: 'var(--color-gray-600, #475467)',
  schema: 'var(--color-gray-500, #667085)',
  service: 'var(--color-gray-400, #98A2B3)',
  dashboard: 'var(--color-pink-500, #EE46BC)',
  pipeline: 'var(--color-warning-500, #EAAA08)',
  user: 'var(--color-rose-500, #F63D68)',
  team: PURPLE_500_COLOR,
  concept: 'var(--color-warning-500, #F79009)',
  tag: 'var(--color-teal-500, #15B79E)',
  query: 'var(--color-indigo-500, #6172F3)',
  topic: 'var(--color-orange-500, #FB6514)',
  container: 'var(--color-violet-600, #7839EE)',
  mlmodel: 'var(--color-teal-600, #0E9384)',
  searchIndex: 'var(--color-gray-blue-500, #4E5BA6)',
  storedProcedure: 'var(--color-purple-400, #9E77ED)',
  testCase: 'var(--color-green-light-500, #66C61C)',
  testSuite: 'var(--color-green-light-600, #4CA30D)',
  dataContract: 'var(--color-pink-600, #DD2590)',
  api: 'var(--color-blue-dark-600, #155EEF)',
  metric: 'var(--color-orange-dark-600, #E04F16)',
  chart: 'var(--color-fuchsia-600, #BA24D5)',
  file: 'var(--color-gray-700, #344054)',
  directory: 'var(--color-warning-700, #B54708)',
};

export const DEFAULT_NODE_COLOR = 'var(--color-gray-modern-400, #9AA3B2)';

export const ENTITY_SIZES: Record<string, number> = {
  domain: 18,
  product: 14,
  table: 12,
  dashboard: 12,
  pipeline: 12,
  database: 11,
  schema: 10,
  service: 9,
  column: 9,
  concept: 11,
  user: 12,
  team: 13,
  tag: 8,
  query: 8,
  topic: 11,
  container: 12,
  mlmodel: 12,
  searchIndex: 11,
  storedProcedure: 9,
  testCase: 9,
  testSuite: 10,
  dataContract: 10,
  api: 10,
  metric: 10,
  chart: 11,
  file: 9,
  directory: 10,
};

export const DEFAULT_NODE_SIZE = 9;

/** Deterministic avatar palette for users/teams (hash(name) -> index). */
export const AVATAR_PALETTE = [
  'var(--color-rose-500, #F63D68)',
  PURPLE_500_COLOR,
  BRAND_500_COLOR,
  'var(--color-teal-500, #15B79E)',
  'var(--color-warning-500, #F79009)',
  'var(--color-pink-500, #EE46BC)',
  'var(--color-blue-light-500, #0BA5EC)',
  'var(--color-indigo-500, #6172F3)',
  'var(--color-pink-600, #DD2590)',
  'var(--color-success-500, #12B76A)',
];

export const LINK_TECHNICAL_COLOR = 'var(--color-border-brand, #3B96F6)';
export const LINK_TECHNICAL_SWATCH = BRAND_500_COLOR;
export const LINK_ONTOLOGY_COLOR = 'var(--color-text-warning-primary, #F79009)';
export const ONTOLOGY_PARTICLE_COLOR = 'var(--color-warning-400, #FDB022)';
export const COVERAGE_GAP_COLOR = 'var(--color-border-error, #F04438)';
export const LABEL_COLOR = 'var(--color-text-primary, #EAF0FB)';
/** Fixed dark foreground preserves contrast on the warning-colored term badge. */
export const TERM_BADGE_TEXT_COLOR = 'var(--color-gray-950, #0E1430)';
export const NODE_ICON_COLOR = 'var(--color-text-white, #FFFFFF)';
export const DIM_LINK_COLOR = 'var(--color-border-secondary, #7A8194)';

export const STAGE_BACKDROP =
  'radial-gradient(130% 120% at 28% 0%, var(--color-bg-brand-primary_alt, #EFF8FF) 0%, var(--color-bg-secondary, #FAFAFA) 52%, var(--color-bg-primary, #FFFFFF) 100%)';

/** The entity type rendered 1.5x larger at each level so hierarchy reads. */
export const PRIMARY_TYPE_BY_LEVEL: Record<Level, NodeType> = {
  asset: 'table',
  product: 'product',
  domain: 'domain',
};

export const PRIMARY_EMPHASIS = 1.5;

/** Camera fly-to distance and animation duration on node select. */
export const CAMERA_FOCUS_DISTANCE = 110;
export const CAMERA_FOCUS_DURATION_MS = 900;

/** Force tuning for readable hub-and-spoke and dense multi-hop layouts. */
export const CHARGE_STRENGTH = -360;
export const LINK_DISTANCE = 84;
export const LINK_STRENGTH = 0.18;

/**
 * Bound the force simulation so the render loop settles instead of animating
 * indefinitely: stop after whichever of these limits is reached first.
 */
export const SIMULATION_COOLDOWN_TICKS = 200;
export const SIMULATION_COOLDOWN_TIME_MS = 8000;

/**
 * Node opacity is applied post-build (once each node's three.js object exists).
 * Re-apply across a few animation frames so it self-corrects as objects are
 * created, rather than guessing a single fixed delay.
 */
export const OPACITY_APPLY_FRAMES = 8;

export const ZOOM_TO_FIT_DURATION_MS = 700;
export const ZOOM_TO_FIT_PADDING = 60;

/**
 * Prevent an early fit from placing the camera inside a graph whose force
 * simulation has not spread out yet. The settled layout is fitted again when
 * the simulation stops, so this only acts as an initial visibility guard.
 */
export const MIN_CAMERA_DISTANCE = 160;

/** Opacity applied to nodes/links outside the active highlight set. */
export const DIMMED_NODE_OPACITY = 0.13;
export const COVERAGE_DIMMED_OPACITY = 0.26;

/** Labels are rendered up to this cap, then progressively disclosed by priority. */
export const LABEL_RENDER_LIMIT = 140;
export const ALWAYS_VISIBLE_LABEL_LIMIT = 18;
export const PRIORITY_LABEL_LIMIT = 18;

/** Dense layouts are widened to use a landscape stage and compressed in depth. */
export const DENSE_GRAPH_NODE_THRESHOLD = 24;
export const TARGET_LAYOUT_VIEWPORT_RATIO = 0.76;
export const MAX_HORIZONTAL_LAYOUT_SCALE = 2.2;
export const DENSE_GRAPH_DEPTH_SCALE = 0.65;

export const LEGEND_TYPES: NodeType[] = [
  'domain',
  'product',
  'table',
  'column',
  'database',
  'schema',
  'service',
  'dashboard',
  'pipeline',
  'topic',
  'container',
  'mlmodel',
  'searchIndex',
  'storedProcedure',
  'chart',
  'api',
  'metric',
  'testCase',
  'testSuite',
  'dataContract',
  'file',
  'directory',
  'concept',
  'tag',
  'user',
  'team',
  'query',
];

/** Entity types whose nodes are rendered as profile avatars, not icon chips. */
export const AVATAR_NODE_TYPES: NodeType[] = ['user', 'team'];

export const ALL_LEVELS: Level[] = ['asset', 'product', 'domain'];
