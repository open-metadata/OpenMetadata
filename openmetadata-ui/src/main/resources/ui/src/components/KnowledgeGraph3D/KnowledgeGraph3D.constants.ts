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

/**
 * Scene-level design constants. These colors are painted onto WebGL materials
 * and canvas textures, so they cannot be sourced from CSS design tokens; they
 * are the exact values fixed by the Knowledge Graph 3D design specification.
 */
export const ENTITY_COLORS: Record<string, string> = {
  domain: '#7A5AF8',
  product: '#17B26A',
  table: '#2E90FA',
  column: '#53B1FD',
  database: '#475467',
  schema: '#667085',
  service: '#98A2B3',
  dashboard: '#EE46BC',
  pipeline: '#EAAA08',
  user: '#F63D68',
  team: '#7A5AF8',
  concept: '#F79009',
  tag: '#15B79E',
  query: '#6172F3',
  topic: '#FB6514',
  container: '#7839EE',
  mlmodel: '#0E9384',
  searchIndex: '#4E5BA6',
  storedProcedure: '#9E77ED',
  testCase: '#66C61C',
  testSuite: '#4CA30D',
  dataContract: '#DD2590',
  api: '#155EEF',
  metric: '#E04F16',
  chart: '#BA24D5',
  file: '#344054',
  directory: '#B54708',
};

export const DEFAULT_NODE_COLOR = '#9AA3B2';

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
  '#F63D68',
  '#7A5AF8',
  '#2E90FA',
  '#15B79E',
  '#F79009',
  '#EE46BC',
  '#0BA5EC',
  '#6172F3',
  '#DD2590',
  '#12B76A',
];

export const LINK_TECHNICAL_COLOR = '#3B96F6';
export const LINK_TECHNICAL_SWATCH = '#2E90FA';
export const LINK_ONTOLOGY_COLOR = '#F79009';
export const ONTOLOGY_PARTICLE_COLOR = '#FDB022';
export const COVERAGE_GAP_COLOR = '#F04438';
export const LABEL_COLOR = '#EAF0FB';
/** Dark text drawn on the orange glossary-term pill laid over ontology-mode assets. */
export const TERM_BADGE_TEXT_COLOR = '#0E1430';

export const STAGE_BACKDROP =
  'radial-gradient(130% 120% at 28% 0%, #182747 0%, #0C1326 52%, #060A16 100%)';

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

/** Charge force keeps clusters separated without exploding the layout. */
export const CHARGE_STRENGTH = -140;

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
export const ZOOM_TO_FIT_PADDING = 90;

/**
 * `zoomToFit` frames node positions, not the (large) node sprites, so sparse
 * graphs end up too close. Pull the camera back to at least this distance from
 * the graph center after framing.
 */
export const MIN_CAMERA_DISTANCE = 320;

/** Opacity applied to nodes/links outside the active highlight set. */
export const DIMMED_NODE_OPACITY = 0.13;
export const COVERAGE_DIMMED_OPACITY = 0.26;

/**
 * Above this node count, always-on labels are both unreadable and costly to
 * rasterize, so they are suppressed (hover still shows the name tooltip).
 */
export const LABEL_NODE_LIMIT = 140;

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
