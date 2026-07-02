/*
 *  Copyright 2025 Collate.
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
import { AxiosError } from 'axios';
import { toCanvas } from 'html-to-image';
import { isUndefined, lowerCase } from 'lodash';
import { ExportData } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { ExportTypes } from '../../constants/Export.constants';
import i18n from '../i18next/LocalUtil';
import { showErrorToast } from '../ToastUtils';

// Caps that keep the exported PNG within Chrome's canvas backend limits and
// V8's max string length. A 16K-square canvas (~64MP) compresses to ~25–50MB
// of PNG bytes — well under the 512MB JS string limit and safely supported by
// every canvas backend Chrome ships.
const MAX_PHYSICAL_PIXELS = 64_000_000;
const MAX_PHYSICAL_DIM = 16_384;
const DESIRED_PIXEL_RATIO = 3;

const computeSafePixelRatio = (
  logicalWidth: number,
  logicalHeight: number
): number => {
  const byArea = Math.sqrt(
    MAX_PHYSICAL_PIXELS / (logicalWidth * logicalHeight)
  );
  const byDim = Math.min(
    MAX_PHYSICAL_DIM / logicalWidth,
    MAX_PHYSICAL_DIM / logicalHeight
  );

  return Math.max(1, Math.min(DESIRED_PIXEL_RATIO, byArea, byDim));
};

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null')),
      'image/png',
      1.0
    );
  });

export const downloadFile = (
  content: string,
  fileName: string,
  mimeType: string = 'text/plain'
): void => {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();

  URL.revokeObjectURL(link.href);
  document.body.removeChild(link);
};

export const downloadBlob = (
  blob: Blob,
  fileName: string,
  exportType: ExportTypes
): void => {
  const a = document.createElement('a');

  a.href = URL.createObjectURL(blob);
  a.download = `${fileName}.${lowerCase(exportType)}`;
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  document.body.removeChild(a);
};

export const exportPNGImageFromElement = async (exportData: ExportData) => {
  const {
    name,
    documentSelector = '',
    viewport,
    renderEdgesOverlay,
  } = exportData;

  const exportElement = document.querySelector(documentSelector);

  if (!exportElement) {
    throw new Error(
      i18n.t('message.error-generating-export-type', {
        exportType: ExportTypes.PNG,
      })
    );
  }

  // Minimum width and height for the image
  const minWidth = 1000;
  const minHeight = 800;
  const padding = 20;

  const imageWidth = Math.max(minWidth, exportElement.scrollWidth);
  const imageHeight = Math.max(minHeight, exportElement.scrollHeight);
  const fullLogicalWidth = imageWidth + padding * 2;
  const fullLogicalHeight = imageHeight + padding * 2;

  // Adaptively reduce pixelRatio for very large lineage graphs so the
  // physical canvas dimensions and resulting PNG bytes stay within browser
  // limits. Without this, a 500-node graph at pixelRatio=3 would request a
  // ~17946×12792 canvas (>16K dim cap) and produce a base64 string >400MB
  // (over V8's max string length) — both of which throw "Invalid string
  // length" or crash the canvas backend.
  const pixelRatio = computeSafePixelRatio(fullLogicalWidth, fullLogicalHeight);

  try {
    const toCanvasOptions = {
      // When compositing with edges, capture nodes without a background so node
      // cards remain opaque but gaps between them are transparent — allowing
      // edges drawn underneath to show through.
      backgroundColor: renderEdgesOverlay ? undefined : '#ffffff',
      width: fullLogicalWidth,
      height: fullLogicalHeight,
      pixelRatio,
      quality: 1.0,
      style: {
        width: imageWidth.toString(),
        height: imageHeight.toString(),
        margin: `${padding}px`,
        minWidth: `${minWidth}px`,
        minHeight: `${minHeight}px`,
        ...(!isUndefined(viewport)
          ? {
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            }
          : {}),
      },
    };

    // Render directly to a canvas — no base64 string round-trip. This avoids
    // the V8 max-string-length blow-up that toPng/toDataURL hit on large
    // lineage graphs.
    const nodesCanvas = await toCanvas(
      exportElement as HTMLElement,
      toCanvasOptions
    );

    if (renderEdgesOverlay) {
      const physicalWidth = fullLogicalWidth * pixelRatio;
      const physicalHeight = fullLogicalHeight * pixelRatio;
      const composite = document.createElement('canvas');
      composite.width = physicalWidth;
      composite.height = physicalHeight;
      const ctx = composite.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get 2D context for composite canvas');
      }

      const edgesCanvas = renderEdgesOverlay(
        imageWidth,
        imageHeight,
        padding,
        pixelRatio
      );

      // Layer order: white background → edges (if available) → nodes.
      // Node cards are opaque so they naturally occlude edges beneath them.
      // If edgesCanvas is null, we still produce a usable white-background PNG.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, physicalWidth, physicalHeight);
      if (edgesCanvas) {
        ctx.drawImage(edgesCanvas, 0, 0);
      }
      ctx.drawImage(nodesCanvas, 0, 0);
      const blob = await canvasToBlob(composite);

      downloadBlob(blob, name, ExportTypes.PNG);

      return;
    }

    const blob = await canvasToBlob(nodesCanvas);

    downloadBlob(blob, name, ExportTypes.PNG);
  } catch (error) {
    const errorMessage = (error as Error).message ?? '';
    const isInvalidStringLength = errorMessage.includes(
      'Invalid string length'
    );

    if (isInvalidStringLength) {
      showErrorToast(
        error as AxiosError,
        i18n.t('message.invalid-string-length-error', {
          exportType: ExportTypes.PNG,
          entity: exportData.title,
        })
      );
    } else {
      showErrorToast(
        error as AxiosError,
        i18n.t('message.error-generating-export-type', {
          exportType: ExportTypes.PNG,
        })
      );
    }
  }
};
