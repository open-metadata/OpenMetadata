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

export const GRAPH_NODE_COLORS = {
  table: {
    background: '#52c41a',
    border: '#389e0d',
    highlight: {
      background: '#73d13d',
      border: '#52c41a',
    },
  },
  database: {
    background: '#1890ff',
    border: '#096dd9',
    highlight: {
      background: '#40a9ff',
      border: '#1890ff',
    },
  },
  schema: {
    background: '#fa8c16',
    border: '#d46b08',
    highlight: {
      background: '#ffa940',
      border: '#fa8c16',
    },
  },
  pipeline: {
    background: '#722ed1',
    border: '#531dab',
    highlight: {
      background: '#9254de',
      border: '#722ed1',
    },
  },
  dashboard: {
    background: '#eb2f96',
    border: '#c41d7f',
    highlight: {
      background: '#f759ab',
      border: '#eb2f96',
    },
  },
  user: {
    background: '#13c2c2',
    border: '#08979c',
    highlight: {
      background: '#36cfc9',
      border: '#13c2c2',
    },
  },
  team: {
    background: '#2f54eb',
    border: '#1d39c4',
    highlight: {
      background: '#597ef7',
      border: '#2f54eb',
    },
  },
  default: {
    background: '#8c8c8c',
    border: '#595959',
    highlight: {
      background: '#bfbfbf',
      border: '#8c8c8c',
    },
  },
};

export const GRAPH_PHYSICS_OPTIONS = {
  forceAtlas2Based: {
    gravitationalConstant: -50,
    centralGravity: 0.01,
    springLength: 100,
    springConstant: 0.08,
    damping: 0.4,
    avoidOverlap: 0.5,
  },
  stabilization: {
    enabled: true,
    iterations: 150,
    updateInterval: 25,
  },
};

export const GRAPH_LAYOUT_OPTIONS = {
  hierarchical: {
    direction: 'UD',
    sortMethod: 'directed',
    shakeTowards: 'roots',
    levelSeparation: 150,
    nodeSpacing: 120,
    treeSpacing: 200,
    blockShifting: true,
    edgeMinimization: true,
    parentCentralization: true,
  },
};

export const GRAPH_INTERACTION_OPTIONS = {
  hover: true,
  tooltipDelay: 200,
  hideEdgesOnDrag: true,
  hideEdgesOnZoom: false,
  navigationButtons: false,
  keyboard: {
    enabled: true,
    speed: { x: 10, y: 10, zoom: 0.02 },
    bindToWindow: false,
  },
  zoomView: true,
  zoomSpeed: 1,
};

export const GRAPH_ANIMATION_OPTIONS = {
  animationDuration: 1000,
  easingFunction: 'easeInOutQuad',
};

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

export const EDGE_STYLE_RESET = {
  stroke: '#d9d9d9',
  lineWidth: 1.5,
  opacity: 1,
  zIndex: 0,
  labelFontWeight: 400,
  labelBackgroundLineWidth: 1,
};

export const EXPORT_FORMAT_TO_ACCEPT_HEADER: Record<string, string> = {
  jsonld: 'application/ld+json',
  turtle: 'text/turtle',
  rdfxml: 'application/rdf+xml',
  ntriples: 'application/n-triples',
};

export const EXPORT_FORMAT_TO_FILE_EXTENSION: Record<string, string> = {
  jsonld: 'jsonld',
  turtle: 'ttl',
  rdfxml: 'rdf',
  ntriples: 'nt',
};

export const NODE_WIDTH = 280;

export const NODE_HEIGHT = 36;
export const MAX_NODE_WIDTH = 280;
export const MIN_NODE_WIDTH = 120;
