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

/** The side panel's `tw:w-80` (320) plus its `tw:right-3.5` (14) offset. */
export const DATA_PANEL_RESERVED_WIDTH = 334;
const CLEARANCE = 16;
const EDGE_PADDING = 16;

export interface PanelClearanceInput {
  containerWidth: number;
  /** Canvas-space left edge that must stay on screen, the lane's or card's. */
  extentLeft: number;
  /** Canvas-space right edge that must stay left of the panel. */
  extentRight: number;
  panelWidth: number;
  x: number;
  zoom: number;
}

/**
 * The horizontal pan that keeps a selected node and its lane left of an open
 * side panel. It only moves the canvas left, and never past the point where
 * the extent's left edge leaves the screen.
 */
export function panXClearOfPanel({
  containerWidth,
  extentLeft,
  extentRight,
  panelWidth,
  x,
  zoom,
}: PanelClearanceInput): number {
  const rightLimit = containerWidth - panelWidth - CLEARANCE;
  const overflow = x + extentRight * zoom - rightLimit;
  if (overflow <= 0) {
    return x;
  }
  const leftmostX = EDGE_PADDING - extentLeft * zoom;

  return Math.max(x - overflow, Math.min(x, leftmostX));
}
