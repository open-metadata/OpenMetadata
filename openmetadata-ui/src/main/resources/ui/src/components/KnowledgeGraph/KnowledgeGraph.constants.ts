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
