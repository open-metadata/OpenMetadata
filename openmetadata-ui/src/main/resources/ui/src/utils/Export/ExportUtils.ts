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
// Ratio 2 (not 3) so the physical canvas stays around ~24Mpx instead of
// ~54Mpx for a real ~3000x2000-logical lineage export. This cuts PNG
// encoding time from ~15s to ~6s and keeps V8 memory sane on large graphs
// without visibly degrading output at zoom levels Collate ships. Note: on
// the ~200-node lineage export the DOM clone step dominates rasterization,
// so this ratio's benefit is mostly on the encode side and on the
// pathological "graph so large the canvas overshoots Chrome's 16K/64Mpx
// caps" branch (where the byArea / byDim caps below take over).
const DESIRED_PIXEL_RATIO = 2;

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

  // No lower floor — for a single-axis graph that already exceeds
  // MAX_PHYSICAL_DIM logically, byDim < 1 and the ratio must go sub-1 to
  // stay inside the cap. A floor of 1 would silently overshoot and either
  // crash the canvas backend or produce a clamped/blank output.
  return Math.min(DESIRED_PIXEL_RATIO, byArea, byDim);
};

// Called per DOM node by html-to-image while cloning the export subtree.
// Returning false skips the node AND everything under it — no cloneNode, no
// getComputedStyle, no serialization. On lineage exports the DOM clone step
// dominates toCanvas cost (linear in element count), so pruning subtrees
// that contribute zero pixels is the highest-leverage optimization
// available here.
//
// Rules (each must be strictly non-visual — a false positive silently drops
// an element from the exported PNG):
//   1. `[data-export-hide="true"]` — explicit opt-out for components that
//      know they don't paint during export (loading spinners, hover-only
//      chrome, dev overlays). Only literal "true" — partial values stay
//      included so a stray attribute doesn't silently drop content.
//   2. `.sr-only` / `.visually-hidden` — screen-reader-only content.
//
// Deliberately NOT filtered: `.react-flow__handle`. React Flow always adds
// that base class to every `<Handle>`, but OpenMetadata's lineage handles
// (`<Handle className="lineage-node-handle" ... />` in CustomNodeV1) are
// styled as visible 20x20 white bordered boxes with an SVG icon (see
// `custom-node.less` `.react-flow .lineage-node-handle`), not the invisible
// pips a blanket class match would assume. Tag any handles that really
// shouldn't paint with `data-export-hide="true"` on a case-by-case basis.
//
// Must be O(1) per node — anything that walks the tree here defeats the
// point.
// Exported for testing — the rules are load-bearing on PNG-export
// correctness (a false positive silently drops an element from the image)
// so each rule must be covered in isolation, not just through the public
// wrapper.
export const shouldIncludeInExport = (node: Element): boolean => {
  if (!(node instanceof HTMLElement)) {
    return true;
  }
  const classList = node.classList;
  if (
    classList?.contains('sr-only') ||
    classList?.contains('visually-hidden')
  ) {
    return false;
  }
  if (node.dataset?.exportHide === 'true') {
    return false;
  }

  return true;
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
  // length" or crash the canvas backend. It also cuts the toCanvas
  // rasterization cost proportionally, which is what actually unblocks the
  // export for graphs in the ~200-node range that otherwise starve the JS
  // main thread for >120s.
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
      // Prune non-visual subtrees before html-to-image clones them —
      // biggest lever we have for cutting DOM-clone time on large exports.
      filter: shouldIncludeInExport,
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
    // lineage graphs, and lets the encoding step be async (canvas.toBlob)
    // instead of a synchronous main-thread stall.
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
