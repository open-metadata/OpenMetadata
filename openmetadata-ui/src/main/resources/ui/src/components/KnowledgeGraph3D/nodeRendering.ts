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

import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import {
  COVERAGE_GAP_COLOR,
  LABEL_COLOR,
  PRIMARY_EMPHASIS,
  PRIMARY_TYPE_BY_LEVEL,
} from './KnowledgeGraph3D.constants';
import {
  avatarCanvas,
  colorFor,
  hexRgba,
  iconCanvas,
  personColor,
  sizeFor,
} from './nodeCanvas';
import { GraphNode3D, Level, NodeType } from './types';

const GLOW_CANVAS_SIZE = 128;
const AVATAR_TEXTURE_CACHE_MAX = 256;

/**
 * Textures are shared across sprites and reused across re-renders. Glow and
 * icon textures are keyed by color/type (a small, fixed set), so plain Maps
 * are inherently bounded. Avatars are keyed by name, so that cache is FIFO-
 * capped. Caching avoids re-rasterizing hundreds of canvases on large graphs.
 */
const glowTextureCache = new Map<string, THREE.CanvasTexture>();
const iconTextureCache = new Map<string, THREE.CanvasTexture>();
const avatarTextureCache = new Map<string, THREE.CanvasTexture>();

const glowColorFor = (node: GraphNode3D): string =>
  node.type === 'user' || node.type === 'team'
    ? personColor(node.name)
    : colorFor(node.type);

const asTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  return texture;
};

const drawGlowCanvas = (color: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GLOW_CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, hexRgba(color, 0.5));
    gradient.addColorStop(0.4, hexRgba(color, 0.18));
    gradient.addColorStop(1, hexRgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GLOW_CANVAS_SIZE, GLOW_CANVAS_SIZE);
  }

  return canvas;
};

const glowTexture = (color: string): THREE.CanvasTexture => {
  let texture = glowTextureCache.get(color);
  if (!texture) {
    texture = asTexture(drawGlowCanvas(color));
    glowTextureCache.set(color, texture);
  }

  return texture;
};

const iconTexture = (type: NodeType): THREE.CanvasTexture => {
  const key = `${type}|${colorFor(type)}`;
  let texture = iconTextureCache.get(key);
  if (!texture) {
    texture = asTexture(iconCanvas(type, colorFor(type)));
    iconTextureCache.set(key, texture);
  }

  return texture;
};

const avatarTexture = (name: string, isTeam: boolean): THREE.CanvasTexture => {
  const key = `${isTeam ? 't' : 'u'}|${name}`;
  let texture = avatarTextureCache.get(key);
  if (!texture) {
    texture = asTexture(avatarCanvas(name, isTeam));
    if (avatarTextureCache.size >= AVATAR_TEXTURE_CACHE_MAX) {
      const oldest = avatarTextureCache.keys().next().value;
      if (oldest !== undefined) {
        // Release the evicted texture's GPU handle — three.js textures are not
        // garbage-collected. The oldest entry belongs to a node no longer in
        // the current capped window, so it is safe to dispose.
        avatarTextureCache.get(oldest)?.dispose();
        avatarTextureCache.delete(oldest);
      }
    }
    avatarTextureCache.set(key, texture);
  }

  return texture;
};

const nodeTexture = (node: GraphNode3D): THREE.CanvasTexture => {
  let texture: THREE.CanvasTexture;
  if (node.type === 'user') {
    texture = avatarTexture(node.name, false);
  } else if (node.type === 'team') {
    texture = avatarTexture(node.name, true);
  } else {
    texture = iconTexture(node.type);
  }

  return texture;
};

const buildCoverageRings = (group: THREE.Group, size: number): void => {
  const radius = size * 0.64;
  [0, Math.PI / 2].forEach((rotation) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.55, 8, 40),
      new THREE.MeshBasicMaterial({
        color: COVERAGE_GAP_COLOR,
        transparent: true,
        opacity: 0.95,
      })
    );
    if (rotation) {
      ring.rotation.x = rotation;
    }
    group.add(ring);
  });
};

/**
 * Builds the full three.js object for a node: an additive glow sprite, the
 * icon-chip / avatar sprite, a camera-facing label, and (in coverage-gap mode)
 * a red double-torus ring for unmapped tables. Ported from the reference
 * `_nodeObject`.
 */
export const buildNodeObject = (
  node: GraphNode3D,
  options: { level: Level; gaps: boolean; showLabel: boolean }
): THREE.Object3D => {
  const group = new THREE.Group();
  const primaryType = PRIMARY_TYPE_BY_LEVEL[options.level];
  const emphasis = node.type === primaryType ? PRIMARY_EMPHASIS : 1;
  const size = sizeFor(node.type) * emphasis;

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(glowColorFor(node)),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.scale.set(size * 2.7, size * 2.7, 1);
  glow.renderOrder = 1;
  group.add(glow);

  const chip = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: nodeTexture(node),
      transparent: true,
      depthWrite: false,
    })
  );
  chip.scale.set(size, size, 1);
  chip.renderOrder = 2;
  group.add(chip);

  if (options.showLabel) {
    const label = new SpriteText(node.name);
    label.color = LABEL_COLOR;
    label.textHeight = Math.max(3.4, size * 0.32);
    label.fontWeight = '600';
    label.position.set(0, -(size * 0.66) - 3, 0);
    label.material.depthWrite = false;
    label.renderOrder = 3;
    group.add(label);
  }

  if (options.gaps && node.type === 'table' && !node.mapped) {
    buildCoverageRings(group, size);
  }

  return group;
};
