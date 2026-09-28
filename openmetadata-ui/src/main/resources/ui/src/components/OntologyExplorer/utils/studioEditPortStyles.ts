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

import { WHITE_COLOR } from '../../../constants/constants';

const STUDIO_EDIT_PORT_PLUS_HALF_SPAN = (14 * 11) / 24 / 2;
const STUDIO_EDIT_PORT_PLUS_LINE_WIDTH = (3 * 11) / 24;
const STUDIO_EDIT_PORT_PLUS_Z_INDEX = 3;
const STUDIO_EDIT_PORT_RADIUS = 9;
const STUDIO_EDIT_PORT_FILL = '#1570EF';
const STUDIO_EDIT_PORT_STROKE_WIDTH = 1;
const STUDIO_EDIT_PORT_SHADOW_BLUR = 5;
const STUDIO_EDIT_PORT_SHADOW_COLOR = 'rgba(21, 112, 239, 0.4)';
const STUDIO_EDIT_PORT_SHADOW_OFFSET_Y = 2;

interface StudioEditPortCircleStyle {
  cursor: 'pointer';
  cx: number;
  cy: number;
  fill: string;
  lineWidth: number;
  r: number;
  shadowBlur: number;
  shadowColor: string;
  shadowOffsetY: number;
  stroke: string;
  zIndex: number;
}

/**
 * The Edit-mode draw handle rendered inside the node (not a G6 port), so existing
 * edges anchor to the node boundary like View mode instead of snapping to the port.
 */
export function getStudioEditPortCircleStyle(
  centerX: number,
  centerY: number
): StudioEditPortCircleStyle {
  return {
    cursor: 'pointer',
    cx: centerX,
    cy: centerY,
    fill: STUDIO_EDIT_PORT_FILL,
    lineWidth: STUDIO_EDIT_PORT_STROKE_WIDTH,
    r: STUDIO_EDIT_PORT_RADIUS,
    shadowBlur: STUDIO_EDIT_PORT_SHADOW_BLUR,
    shadowColor: STUDIO_EDIT_PORT_SHADOW_COLOR,
    shadowOffsetY: STUDIO_EDIT_PORT_SHADOW_OFFSET_Y,
    stroke: WHITE_COLOR,
    zIndex: STUDIO_EDIT_PORT_PLUS_Z_INDEX - 1,
  };
}

interface StudioEditPortPlusLineStyle {
  lineCap: 'round';
  lineWidth: number;
  pointerEvents: 'none';
  stroke: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  zIndex: number;
}

export function getStudioEditPortPlusLineStyles(
  centerX: number,
  centerY: number
): [StudioEditPortPlusLineStyle, StudioEditPortPlusLineStyle] {
  const sharedStyle = {
    lineCap: 'round' as const,
    lineWidth: STUDIO_EDIT_PORT_PLUS_LINE_WIDTH,
    pointerEvents: 'none' as const,
    stroke: WHITE_COLOR,
    zIndex: STUDIO_EDIT_PORT_PLUS_Z_INDEX,
  };

  return [
    {
      ...sharedStyle,
      x1: centerX - STUDIO_EDIT_PORT_PLUS_HALF_SPAN,
      x2: centerX + STUDIO_EDIT_PORT_PLUS_HALF_SPAN,
      y1: centerY,
      y2: centerY,
    },
    {
      ...sharedStyle,
      x1: centerX,
      x2: centerX,
      y1: centerY - STUDIO_EDIT_PORT_PLUS_HALF_SPAN,
      y2: centerY + STUDIO_EDIT_PORT_PLUS_HALF_SPAN,
    },
  ];
}
