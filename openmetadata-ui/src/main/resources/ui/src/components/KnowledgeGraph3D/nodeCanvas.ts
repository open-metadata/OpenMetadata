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

/**
 * Pure canvas + color helpers for the Knowledge Graph 3D nodes. This module
 * intentionally has NO three.js dependency so the controls/legend/panel can
 * use `colorFor` and the icon/avatar canvases without pulling the WebGL bundle;
 * the three.js object builder lives in `nodeRendering.ts`, loaded only with the
 * lazy scene.
 */

import {
  AVATAR_PALETTE,
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_SIZE,
  ENTITY_COLORS,
  ENTITY_SIZES,
} from './KnowledgeGraph3D.constants';
import { NodeType } from './types';

const CANVAS_SIZE = 180;

export const colorFor = (type: string): string =>
  ENTITY_COLORS[type] ?? DEFAULT_NODE_COLOR;

export const sizeFor = (type: string): number =>
  ENTITY_SIZES[type] ?? DEFAULT_NODE_SIZE;

export const hexRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  return `rgba(${r},${g},${b},${alpha})`;
};

export const lighten = (hex: string, amount: number): string => {
  const h = hex.replace('#', '');
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + amount);

  return `rgb(${r},${g},${b})`;
};

export const personColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }

  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
};

export const initials = (name: string): string => {
  const parts = name
    .replace(/[^A-Za-z ]/g, ' ')
    .trim()
    .split(/\s+/);
  const value =
    parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];

  return value.toUpperCase();
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawIcon = (type: NodeType, ctx: CanvasRenderingContext2D): void => {
  const L = 56;
  const R = 124;
  const T = 56;
  const B = 124;
  const C = 90;
  const line = (a: number, b: number, c: number, d: number): void => {
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.lineTo(c, d);
    ctx.stroke();
  };
  const rr = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill?: boolean
  ): void => {
    roundedRect(ctx, x, y, w, h, r);
    fill ? ctx.fill() : ctx.stroke();
  };
  const circ = (x: number, y: number, r: number, fill?: boolean): void => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    fill ? ctx.fill() : ctx.stroke();
  };
  const ell = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    a0: number,
    a1: number
  ): void => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, a0, a1);
    ctx.stroke();
  };

  switch (type) {
    case 'table':
      rr(L, T, R - L, B - T, 8);
      line(L, T + 20, R, T + 20);
      line(C, T + 20, C, B);
      line(L, T + 47, R, T + 47);

      break;
    case 'column':
      rr(C - 16, T, 32, B - T, 7);
      line(C - 16, T + 20, C + 16, T + 20);
      line(C - 16, T + 37, C + 16, T + 37);
      line(C - 16, T + 54, C + 16, T + 54);

      break;
    case 'database': {
      const rx = 30;
      const ry = 11;
      const ty = T + 10;
      const by = B - 10;
      ell(C, ty, rx, ry, 0, 2 * Math.PI);
      line(C - rx, ty, C - rx, by);
      line(C + rx, ty, C + rx, by);
      ell(C, by, rx, ry, 0, Math.PI);
      ell(C, (ty + by) / 2, rx, ry, 0, Math.PI);

      break;
    }
    case 'schema': {
      const bw = 26;
      const bh = 16;
      const lcx = L + 13;
      const rcx = R - 13;
      rr(C - 13, T, bw, bh, 4);
      rr(L, B - bh, bw, bh, 4);
      rr(R - bw, B - bh, bw, bh, 4);
      line(C, T + bh, C, T + 30);
      line(lcx, T + 30, rcx, T + 30);
      line(lcx, T + 30, lcx, B - bh);
      line(rcx, T + 30, rcx, B - bh);

      break;
    }
    case 'dashboard':
    case 'pipeline': {
      [
        [L + 2, 28],
        [C - 7, 46],
        [R - 18, 36],
      ].forEach((p) => rr(p[0], B - p[1], 15, p[1], 3, true));
      line(L - 3, B + 1, R + 3, B + 1);

      break;
    }
    case 'user':
      circ(C, T + 15, 13);
      ctx.beginPath();
      ctx.arc(C, B + 8, 27, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();

      break;
    case 'concept':
      circ(C, T + 16, 9);
      circ(L + 9, B - 12, 8);
      circ(R - 9, B - 12, 8);
      line(C - 5, T + 23, L + 13, B - 18);
      line(C + 5, T + 23, R - 13, B - 18);

      break;
    case 'domain':
      circ(C, C, 31);
      ell(C, C, 12, 31, 0, 2 * Math.PI);
      line(C - 31, C, C + 31, C);
      line(C - 27, C - 16, C + 27, C - 16);
      line(C - 27, C + 16, C + 27, C + 16);

      break;
    case 'product':
      rr(L, T + 6, R - L, B - T - 12, 6);
      line(L, T + 27, R, T + 27);
      line(C, T + 6, C, T + 27);

      break;
    case 'tag':
      ctx.beginPath();
      ctx.moveTo(L + 22, T);
      ctx.lineTo(R, T);
      ctx.lineTo(R, B);
      ctx.lineTo(L + 22, B);
      ctx.lineTo(L, C);
      ctx.closePath();
      ctx.stroke();
      circ(L + 28, C, 5);

      break;
    case 'service':
      rr(L, T + 4, R - L, 26, 5);
      rr(L, T + 38, R - L, 26, 5);
      circ(L + 12, T + 17, 3, true);
      circ(L + 12, T + 51, 3, true);
      line(C - 4, T + 17, R - 12, T + 17);
      line(C - 4, T + 51, R - 12, T + 51);

      break;
    case 'query':
      ctx.beginPath();
      ctx.moveTo(C - 8, T + 12);
      ctx.lineTo(L + 4, C);
      ctx.lineTo(C - 8, B - 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(C + 8, T + 12);
      ctx.lineTo(R - 4, C);
      ctx.lineTo(C + 8, B - 12);
      ctx.stroke();
      line(C + 7, T + 8, C - 7, B - 8);

      break;
    case 'topic': {
      rr(L, T, R - L, 40, 10);
      ctx.beginPath();
      ctx.moveTo(L + 14, T + 40);
      ctx.lineTo(L + 14, T + 52);
      ctx.lineTo(L + 28, T + 40);
      ctx.stroke();
      circ(C - 16, T + 20, 3.5, true);
      circ(C, T + 20, 3.5, true);
      circ(C + 16, T + 20, 3.5, true);

      break;
    }
    case 'container': {
      ctx.beginPath();
      ctx.moveTo(L + 10, T + 18);
      ctx.lineTo(C, T + 6);
      ctx.lineTo(R - 10, T + 18);
      ctx.lineTo(C, T + 30);
      ctx.closePath();
      ctx.stroke();
      line(L + 10, T + 18, L + 10, B - 10);
      line(R - 10, T + 18, R - 10, B - 10);
      line(C, T + 30, C, B + 2);
      line(L + 10, B - 10, C, B + 2);
      line(R - 10, B - 10, C, B + 2);

      break;
    }
    case 'mlmodel': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = C + 32 * Math.cos(angle);
        const y = C + 32 * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      circ(C, C, 6, true);

      break;
    }
    case 'searchIndex':
      circ(C - 6, C - 8, 20);
      line(C + 8, C + 6, R - 6, B - 2);

      break;
    case 'storedProcedure': {
      circ(C, C, 22);
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        line(
          C + 22 * Math.cos(angle),
          C + 22 * Math.sin(angle),
          C + 30 * Math.cos(angle),
          C + 30 * Math.sin(angle)
        );
      }
      circ(C, C, 8);

      break;
    }
    case 'testCase':
      ctx.beginPath();
      ctx.moveTo(L + 14, C + 4);
      ctx.lineTo(C - 6, B - 14);
      ctx.lineTo(R - 12, T + 14);
      ctx.stroke();

      break;
    case 'testSuite':
      [T + 14, C, B - 14].forEach((yi) => {
        ctx.beginPath();
        ctx.moveTo(L + 4, yi);
        ctx.lineTo(L + 10, yi + 6);
        ctx.lineTo(L + 20, yi - 6);
        ctx.stroke();
        line(L + 28, yi, R - 6, yi);
      });

      break;
    case 'dataContract':
      rr(L + 10, T, R - L - 26, B - T, 4);
      line(L + 18, T + 16, R - 22, T + 16);
      line(L + 18, T + 30, R - 22, T + 30);
      line(L + 18, T + 44, C + 4, T + 44);
      circ(R - 14, B - 12, 12);
      ctx.beginPath();
      ctx.moveTo(R - 20, B - 12);
      ctx.lineTo(R - 15, B - 7);
      ctx.lineTo(R - 8, B - 18);
      ctx.stroke();

      break;
    case 'api':
      circ(L + 12, C, 8);
      circ(R - 12, C, 8);
      circ(C, C, 5, true);
      line(L + 20, C, C - 5, C);
      line(C + 5, C, R - 20, C);

      break;
    case 'metric':
      ctx.beginPath();
      ctx.arc(C, C + 12, 30, Math.PI, 2 * Math.PI);
      ctx.stroke();
      line(C, C + 12, C + 18, C - 10);
      circ(C, C + 12, 4, true);

      break;
    case 'chart':
      line(L + 4, T + 2, L + 4, B - 2);
      line(L + 4, B - 2, R - 2, B - 2);
      ctx.beginPath();
      ctx.moveTo(L + 12, B - 12);
      ctx.lineTo(C - 10, C + 4);
      ctx.lineTo(C + 8, C - 8);
      ctx.lineTo(R - 8, T + 10);
      ctx.stroke();

      break;
    case 'file':
      ctx.beginPath();
      ctx.moveTo(L + 16, T);
      ctx.lineTo(R - 24, T);
      ctx.lineTo(R - 14, T + 10);
      ctx.lineTo(R - 14, B);
      ctx.lineTo(L + 16, B);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(R - 24, T);
      ctx.lineTo(R - 24, T + 10);
      ctx.lineTo(R - 14, T + 10);
      ctx.stroke();
      line(L + 24, T + 26, R - 22, T + 26);
      line(L + 24, T + 40, R - 22, T + 40);
      line(L + 24, T + 54, C, T + 54);

      break;
    case 'directory':
      ctx.beginPath();
      ctx.moveTo(L + 4, T + 12);
      ctx.lineTo(L + 24, T + 12);
      ctx.lineTo(L + 30, T + 20);
      ctx.lineTo(R - 4, T + 20);
      ctx.lineTo(R - 4, B - 8);
      ctx.lineTo(L + 4, B - 8);
      ctx.closePath();
      ctx.stroke();

      break;
    default:
      circ(C, C, 28);
  }
};

export const iconCanvas = (
  type: NodeType,
  color: string
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }

  roundedRect(ctx, 12, 12, 156, 156, 40);
  ctx.fillStyle = color;
  ctx.fill();
  const gradient = ctx.createLinearGradient(0, 12, 0, 168);
  gradient.addColorStop(0, 'rgba(255,255,255,.22)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawIcon(type, ctx);

  return canvas;
};

export const avatarCanvas = (
  name: string,
  isTeam: boolean
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }

  const color = personColor(name);
  const cx = 90;
  const cy = 90;
  const radius = isTeam ? 56 : 66;
  if (isTeam) {
    ctx.beginPath();
    ctx.arc(cx - 24, cy - 18, radius - 4, 0, 2 * Math.PI);
    ctx.fillStyle = hexRgba(color, 0.45);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 24, cy - 18, radius - 4, 0, 2 * Math.PI);
    ctx.fillStyle = hexRgba(color, 0.3);
    ctx.fill();
  }
  const gradient = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
  gradient.addColorStop(0, lighten(color, 30));
  gradient.addColorStop(1, color);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255,255,255,.92)';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${isTeam ? 50 : 58}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials(name), cx, cy + 3);

  return canvas;
};
