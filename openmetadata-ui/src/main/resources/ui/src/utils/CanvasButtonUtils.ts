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
import { CANVAS_BUTTON_COLORS } from '../constants/Color.constants';
import { StatusType } from '../generated/entity/data/pipeline';

export enum ECanvasButtonType {
  Pipeline = 'pipeline',
  Function = 'function',
}

export interface CanvasButton {
  x: number;
  y: number;
  width: number;
  height: number;
  edgeId: string;
  type: ECanvasButtonType;
  executionStatus?: StatusType;
  isPipelineRootNode?: boolean;
}

const BUTTON_SIZE = 36;
const ICON_SIZE = 14;
const BORDER_RADIUS = 8;

export function isPointInButton(
  x: number,
  y: number,
  button: CanvasButton
): boolean {
  return (
    x >= button.x - button.width / 2 &&
    x <= button.x + button.width / 2 &&
    y >= button.y - button.height / 2 &&
    y <= button.y + button.height / 2
  );
}

interface StatusColors {
  border: string;
  background: string;
  icon: string;
}

function getStatusColors(executionStatus?: StatusType): StatusColors {
  if (!executionStatus) {
    return CANVAS_BUTTON_COLORS.DEFAULT;
  }

  switch (executionStatus) {
    case StatusType.Successful:
      return CANVAS_BUTTON_COLORS.SUCCESS;
    case StatusType.Failed:
      return CANVAS_BUTTON_COLORS.FAILED;
    case StatusType.Pending:
    case StatusType.Skipped:
      return CANVAS_BUTTON_COLORS.PENDING;
    default:
      return CANVAS_BUTTON_COLORS.DEFAULT;
  }
}

function drawPipelineIcon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;

  const scale = size / 16;
  const offsetX = centerX - size / 2;
  const offsetY = centerY - size / 2;

  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const pathData =
    'M10.667 3.667a.5.5 0 1 0 0-1v1ZM7.605 10.94a.5.5 0 0 0 .79-.614l-.79.614Z' +
    'M5.333 2.667a.5.5 0 1 0 0 1v-1Zm-.672 2.86-.307-.395-.789.614.307.394.79-.614Z' +
    'm6.006-2.86H5.333v1h5.334v-1ZM3.872 6.14l3.733 4.8.79-.614-3.734-4.8-.789.614Z';

  const path = new Path2D(pathData);
  ctx.fill(path);

  const rectPath1 = new Path2D();
  rectPath1.rect(11.167, 1, 4.333, 4.333);
  ctx.stroke(rectPath1);

  const rectPath2 = new Path2D();
  rectPath2.rect(0.5, 1, 4.333, 4.333);
  ctx.stroke(rectPath2);

  const rectPath3 = new Path2D();
  rectPath3.rect(7.967, 10.6, 4.333, 4.333);
  ctx.stroke(rectPath3);

  ctx.restore();
}

function drawFunctionIcon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `bold ${size * 0.9}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ƒx', centerX, centerY);
  ctx.restore();
}

export function drawCanvasButton(
  ctx: CanvasRenderingContext2D,
  button: CanvasButton,
  isHovered: boolean = false,
  isDQEnabled: boolean = false
) {
  ctx.save();

  const statusColors = isDQEnabled
    ? getStatusColors(button.executionStatus)
    : CANVAS_BUTTON_COLORS.DEFAULT;

  const borderColor = isHovered
    ? CANVAS_BUTTON_COLORS.HOVER.border
    : statusColors.border;
  const bgColor = isHovered
    ? CANVAS_BUTTON_COLORS.HOVER.background
    : statusColors.background;
  const iconColor = isHovered
    ? CANVAS_BUTTON_COLORS.HOVER.icon
    : statusColors.icon;

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;

  const halfWidth = button.width / 2;
  const halfHeight = button.height / 2;
  const radius = BORDER_RADIUS;

  ctx.beginPath();
  ctx.moveTo(button.x - halfWidth + radius, button.y - halfHeight);
  ctx.lineTo(button.x + halfWidth - radius, button.y - halfHeight);
  ctx.quadraticCurveTo(
    button.x + halfWidth,
    button.y - halfHeight,
    button.x + halfWidth,
    button.y - halfHeight + radius
  );
  ctx.lineTo(button.x + halfWidth, button.y + halfHeight - radius);
  ctx.quadraticCurveTo(
    button.x + halfWidth,
    button.y + halfHeight,
    button.x + halfWidth - radius,
    button.y + halfHeight
  );
  ctx.lineTo(button.x - halfWidth + radius, button.y + halfHeight);
  ctx.quadraticCurveTo(
    button.x - halfWidth,
    button.y + halfHeight,
    button.x - halfWidth,
    button.y + halfHeight - radius
  );
  ctx.lineTo(button.x - halfWidth, button.y - halfHeight + radius);
  ctx.quadraticCurveTo(
    button.x - halfWidth,
    button.y - halfHeight,
    button.x - halfWidth + radius,
    button.y - halfHeight
  );
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  if (button.isPipelineRootNode && button.executionStatus) {
    const pulseRadius = halfWidth + 2;
    ctx.strokeStyle = statusColors.border;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(button.x, button.y, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (button.type === 'pipeline') {
    drawPipelineIcon(ctx, button.x, button.y, ICON_SIZE, iconColor);
  } else {
    drawFunctionIcon(ctx, button.x, button.y, ICON_SIZE, iconColor);
  }

  ctx.restore();
}

export function createCanvasButton(
  x: number,
  y: number,
  edgeId: string,
  type: ECanvasButtonType,
  executionStatus?: StatusType,
  isPipelineRootNode?: boolean
): CanvasButton {
  return {
    x,
    y,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    edgeId,
    type,
    executionStatus,
    isPipelineRootNode,
  };
}
