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
import { toCanvas } from 'html-to-image';
import { ExportData } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { ExportTypes } from '../../constants/Export.constants';
import { showErrorToast } from '../ToastUtils';
import {
  downloadBlob,
  downloadFile,
  exportPNGImageFromElement,
  shouldIncludeInExport,
} from './ExportUtils';

jest.mock('html-to-image', () => ({
  toCanvas: jest.fn(),
}));

jest.mock('../ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('ExportUtils', () => {
  describe('downloadFile', () => {
    const mockLink = {
      href: '',
      download: '',
      style: { visibility: '' },
      click: jest.fn(),
    };
    let mockCreateObjectURL: jest.Mock;
    let mockRevokeObjectURL: jest.Mock;
    let originalBlob: typeof Blob;

    beforeEach(() => {
      originalBlob = global.Blob;
      mockCreateObjectURL = jest.fn().mockReturnValue('blob:mock-url');
      mockRevokeObjectURL = jest.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      jest
        .spyOn(document, 'createElement')
        .mockReturnValue(mockLink as unknown as HTMLElement);
      jest.spyOn(document.body, 'appendChild').mockImplementation(jest.fn());
      jest.spyOn(document.body, 'removeChild').mockImplementation(jest.fn());
      mockLink.click.mockClear();
      mockLink.href = '';
      mockLink.download = '';
      mockLink.style.visibility = '';
    });

    afterEach(() => {
      global.Blob = originalBlob;
      jest.restoreAllMocks();
    });

    it('creates an anchor element and triggers a click', () => {
      downloadFile('a,b\n1,2', 'test.csv');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalledTimes(1);
    });

    it('sets the correct download filename', () => {
      downloadFile('a,b\n1,2', 'my_export.csv');

      expect(mockLink.download).toBe('my_export.csv');
    });

    it('hides the link element', () => {
      downloadFile('a,b\n1,2', 'test.csv');

      expect(mockLink.style.visibility).toBe('hidden');
    });

    it('appends and removes the link from the DOM', () => {
      downloadFile('a,b\n1,2', 'test.csv');

      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });

    it('revokes the object URL after download', () => {
      downloadFile('a,b\n1,2', 'test.csv');

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('uses the provided mimeType when creating the Blob', () => {
      const mockBlob = {};
      const MockBlob = jest.fn().mockReturnValue(mockBlob);
      global.Blob = MockBlob as unknown as typeof Blob;

      downloadFile('content', 'file.csv', 'text/csv;charset=utf-8;');

      expect(MockBlob).toHaveBeenCalledWith(['content'], {
        type: 'text/csv;charset=utf-8;',
      });
    });
  });

  describe('downloadBlob', () => {
    const mockLink = {
      href: '',
      download: '',
      style: { visibility: '' },
      click: jest.fn(),
    };
    let mockCreateObjectURL: jest.Mock;
    let mockRevokeObjectURL: jest.Mock;

    beforeEach(() => {
      mockCreateObjectURL = jest.fn().mockReturnValue('blob:mock-png-url');
      mockRevokeObjectURL = jest.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      jest
        .spyOn(document, 'createElement')
        .mockReturnValue(mockLink as unknown as HTMLElement);
      jest.spyOn(document.body, 'appendChild').mockImplementation(jest.fn());
      jest.spyOn(document.body, 'removeChild').mockImplementation(jest.fn());
      mockLink.click.mockClear();
      mockLink.href = '';
      mockLink.download = '';
      mockLink.style.visibility = '';
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('creates an anchor element and triggers a click', () => {
      const blob = new Blob(['png-bytes'], { type: 'image/png' });

      downloadBlob(blob, 'test-image', ExportTypes.PNG);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalledTimes(1);
    });

    it('sets the correct download filename with lowercased extension', () => {
      const blob = new Blob(['png-bytes'], { type: 'image/png' });

      downloadBlob(blob, 'my_chart', ExportTypes.PNG);

      expect(mockLink.download).toBe('my_chart.png');
    });

    it('hides the link element', () => {
      const blob = new Blob(['png-bytes'], { type: 'image/png' });

      downloadBlob(blob, 'test-image', ExportTypes.PNG);

      expect(mockLink.style.visibility).toBe('hidden');
    });

    it('appends and removes the link from the DOM', () => {
      const blob = new Blob(['png-bytes'], { type: 'image/png' });

      downloadBlob(blob, 'test-image', ExportTypes.PNG);

      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });

    it('creates a blob URL from the provided Blob', () => {
      const blob = new Blob(['png-bytes'], { type: 'image/png' });

      downloadBlob(blob, 'test-image', ExportTypes.PNG);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
      expect(mockLink.href).toBe('blob:mock-png-url');
    });

    it('revokes the object URL after download', () => {
      const blob = new Blob(['png-bytes'], { type: 'image/png' });

      downloadBlob(blob, 'test-image', ExportTypes.PNG);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-png-url');
    });
  });

  describe('exportPNGImageFromElement', () => {
    const mockExportData: ExportData = {
      name: 'test-export',
      documentSelector: '#test-element',
      exportTypes: [ExportTypes.PNG],
      onExport: jest.fn(),
    };

    const mockElement = {
      scrollWidth: 1200,
      scrollHeight: 900,
    };

    let mockNodesCanvas: HTMLCanvasElement;
    let mockNodesBlob: Blob;
    let mockCompositeBlob: Blob;
    let mockCompositeCtx: Record<string, jest.Mock | string | number>;
    let mockCompositeCanvas: HTMLCanvasElement;

    beforeEach(() => {
      mockNodesBlob = new Blob(['nodes'], { type: 'image/png' });
      mockNodesCanvas = {
        width: 0,
        height: 0,
        toBlob: jest.fn((cb: (blob: Blob | null) => void) => cb(mockNodesBlob)),
      } as unknown as HTMLCanvasElement;
      (toCanvas as jest.Mock).mockResolvedValue(mockNodesCanvas);

      document.querySelector = jest.fn().mockReturnValue(mockElement);

      mockCompositeCtx = {
        fillStyle: '',
        fillRect: jest.fn(),
        drawImage: jest.fn(),
      };
      mockCompositeBlob = new Blob(['composite'], { type: 'image/png' });
      mockCompositeCanvas = {
        width: 0,
        height: 0,
        getContext: jest.fn().mockReturnValue(mockCompositeCtx),
        toBlob: jest.fn((cb: (blob: Blob | null) => void) =>
          cb(mockCompositeBlob)
        ),
      } as unknown as HTMLCanvasElement;

      jest
        .spyOn(document, 'createElement')
        .mockImplementation((tag: string) => {
          if (tag === 'canvas') {
            return mockCompositeCanvas as unknown as HTMLElement;
          }
          if (tag === 'a') {
            return {
              href: '',
              download: '',
              style: { visibility: '' },
              click: jest.fn(),
            } as unknown as HTMLElement;
          }

          return document.createElement(tag);
        });
      jest.spyOn(document.body, 'appendChild').mockImplementation(jest.fn());
      jest.spyOn(document.body, 'removeChild').mockImplementation(jest.fn());
      global.URL.createObjectURL = jest.fn().mockReturnValue('blob:test-url');
      global.URL.revokeObjectURL = jest.fn();
    });

    afterEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });

    it('renders to a canvas and downloads as a Blob (no base64 string)', async () => {
      await exportPNGImageFromElement(mockExportData);

      expect(document.querySelector).toHaveBeenCalledWith('#test-element');
      expect(toCanvas).toHaveBeenCalledWith(
        mockElement,
        expect.objectContaining({
          backgroundColor: '#ffffff',
          width: 1240, // 1200 + (20 * 2) padding
          height: 940, // 900 + (20 * 2) padding
        })
      );
      // canvas.toBlob is used instead of toDataURL — no JS string round-trip
      expect(mockNodesCanvas.toBlob).toHaveBeenCalled();
    });

    it('passes margin/minWidth/minHeight style to toCanvas', async () => {
      await exportPNGImageFromElement(mockExportData);

      expect(toCanvas).toHaveBeenCalledWith(
        mockElement,
        expect.objectContaining({
          style: expect.objectContaining({
            width: '1200',
            height: '900',
            margin: '20px',
            minWidth: '1000px',
            minHeight: '800px',
          }),
        })
      );
    });

    it('uses the desired pixelRatio of 2 for small graphs', async () => {
      // 2 (not 3) so the encode step stays fast on large graphs — see
      // ExportUtils.ts comment on DESIRED_PIXEL_RATIO.
      await exportPNGImageFromElement(mockExportData);

      expect(toCanvas).toHaveBeenCalledWith(
        mockElement,
        expect.objectContaining({ pixelRatio: 2 })
      );
    });

    it('caps pixelRatio for very large graphs to keep canvas under 16K px', async () => {
      // A 10000x8000 logical graph at pixelRatio=2 would be 20000x16000 —
      // over Chrome's 16K per-side cap. Adaptive cap must drop pixelRatio
      // below 2.
      document.querySelector = jest.fn().mockReturnValue({
        scrollWidth: 10000,
        scrollHeight: 8000,
      });

      await exportPNGImageFromElement(mockExportData);

      const callArgs = (toCanvas as jest.Mock).mock.calls[0][1];

      expect(callArgs.pixelRatio).toBeLessThan(2);
      expect(callArgs.pixelRatio).toBeGreaterThan(0);

      // Resulting physical dims must respect both the area and side-length
      // caps. Allow a tiny floating-point tolerance — sqrt-based math lands
      // exactly on the boundary and the binary representation can overshoot
      // by a few ULPs.
      const physicalW = callArgs.width * callArgs.pixelRatio;
      const physicalH = callArgs.height * callArgs.pixelRatio;
      const epsilon = 1;

      expect(physicalW).toBeLessThanOrEqual(16_384 + epsilon);
      expect(physicalH).toBeLessThanOrEqual(16_384 + epsilon);
      expect(physicalW * physicalH).toBeLessThanOrEqual(64_000_000 + epsilon);
    });

    it('allows sub-1 pixelRatio when a single logical dimension already exceeds the cap', async () => {
      // A 20000x800 logical graph is over the 16384 dim cap on width alone.
      // The safe ratio must go below 1 so the physical canvas stays inside
      // the cap; a floor of 1 would silently overshoot.
      document.querySelector = jest.fn().mockReturnValue({
        scrollWidth: 20000,
        scrollHeight: 800,
      });

      await exportPNGImageFromElement(mockExportData);

      const callArgs = (toCanvas as jest.Mock).mock.calls[0][1];

      expect(callArgs.pixelRatio).toBeLessThan(1);

      const physicalW = callArgs.width * callArgs.pixelRatio;
      const epsilon = 1;

      expect(physicalW).toBeLessThanOrEqual(16_384 + epsilon);
    });

    it('throws when element is not found', async () => {
      document.querySelector = jest.fn().mockReturnValue(null);

      await expect(exportPNGImageFromElement(mockExportData)).rejects.toThrow(
        'message.error-generating-export-type'
      );
    });

    it('passes a filter callback to toCanvas', async () => {
      await exportPNGImageFromElement(mockExportData);

      expect(toCanvas).toHaveBeenCalledWith(
        mockElement,
        expect.objectContaining({ filter: expect.any(Function) })
      );
    });

    it('applies viewport transformation when provided', async () => {
      const exportDataWithViewport = {
        ...mockExportData,
        viewport: {
          x: 100,
          y: 200,
          zoom: 1.5,
        },
      };

      await exportPNGImageFromElement(exportDataWithViewport);

      expect(toCanvas).toHaveBeenCalledWith(
        mockElement,
        expect.objectContaining({
          style: expect.objectContaining({
            transform: 'translate(100px, 200px) scale(1.5)',
          }),
        })
      );
    });

    it('shows the invalid-string-length toast when toCanvas throws that error', async () => {
      const error = new Error('Invalid string length');
      (toCanvas as jest.Mock).mockRejectedValue(error);

      await exportPNGImageFromElement(mockExportData);

      expect(showErrorToast).toHaveBeenCalledWith(
        error,
        'message.invalid-string-length-error'
      );
    });

    it('shows the generic export error toast for other errors', async () => {
      const error = new Error('PNG generation failed');
      (toCanvas as jest.Mock).mockRejectedValue(error);

      await exportPNGImageFromElement(mockExportData);

      expect(showErrorToast).toHaveBeenCalledWith(
        error,
        'message.error-generating-export-type'
      );
    });

    describe('renderEdgesOverlay composite path', () => {
      const mockEdgesCanvas = {
        width: 3720,
        height: 2820,
      } as HTMLCanvasElement;

      const exportDataWithEdges: ExportData = {
        ...mockExportData,
        renderEdgesOverlay: jest.fn().mockReturnValue(mockEdgesCanvas),
      };

      it('captures nodes without background color when renderEdgesOverlay is provided', async () => {
        await exportPNGImageFromElement(exportDataWithEdges);

        expect(toCanvas).toHaveBeenCalledWith(
          mockElement,
          expect.objectContaining({ backgroundColor: undefined })
        );
      });

      it('uses white background when no renderEdgesOverlay (non-composite path)', async () => {
        await exportPNGImageFromElement(mockExportData);

        expect(toCanvas).toHaveBeenCalledWith(
          mockElement,
          expect.objectContaining({ backgroundColor: '#ffffff' })
        );
      });

      it('calls renderEdgesOverlay with correct dimensions', async () => {
        await exportPNGImageFromElement(exportDataWithEdges);

        expect(exportDataWithEdges.renderEdgesOverlay).toHaveBeenCalledWith(
          1200, // imageWidth
          900, // imageHeight
          20, // padding
          2 // pixelRatio — small graph so no cap, uses DESIRED_PIXEL_RATIO
        );
      });

      it('fills composite canvas with white background before drawing', async () => {
        await exportPNGImageFromElement(exportDataWithEdges);

        expect(mockCompositeCtx.fillStyle).toBe('#ffffff');
        expect(mockCompositeCtx.fillRect).toHaveBeenCalledWith(
          0,
          0,
          (1200 + 40) * 2,
          (900 + 40) * 2
        );
      });

      it('draws edges before nodes so edges appear behind node cards', async () => {
        await exportPNGImageFromElement(exportDataWithEdges);

        const drawCalls = (mockCompositeCtx.drawImage as jest.Mock).mock.calls;

        // First drawImage call must be the edges canvas
        expect(drawCalls[0][0]).toBe(mockEdgesCanvas);
        // Second drawImage call must be the nodes canvas — drawn directly,
        // no Image + base64 round-trip.
        expect(drawCalls[1][0]).toBe(mockNodesCanvas);
      });

      it('uses composite.toBlob for download, not toDataURL', async () => {
        await exportPNGImageFromElement(exportDataWithEdges);

        // composite.toBlob() must have been called — this is what gets downloaded
        expect(mockCompositeCanvas.toBlob).toHaveBeenCalled();
      });

      it('produces a usable white-background image when edgesCanvas is null', async () => {
        const exportDataNullEdges: ExportData = {
          ...mockExportData,
          renderEdgesOverlay: jest.fn().mockReturnValue(null),
        };

        await exportPNGImageFromElement(exportDataNullEdges);

        // White fill must still happen so no transparent fallback
        expect(mockCompositeCtx.fillRect).toHaveBeenCalled();

        // Only the nodes canvas is drawn — no edges canvas
        const drawCalls = (mockCompositeCtx.drawImage as jest.Mock).mock.calls;

        expect(drawCalls).toHaveLength(1);
        expect(drawCalls[0][0]).toBe(mockNodesCanvas);
      });

      it('shows error toast when composite canvas 2D context is unavailable', async () => {
        (mockCompositeCanvas.getContext as jest.Mock).mockReturnValueOnce(null);

        await exportPNGImageFromElement(exportDataWithEdges);

        expect(showErrorToast).toHaveBeenCalledWith(
          expect.any(Error),
          'message.error-generating-export-type'
        );
      });
    });
  });
});

// Kept out of the `ExportUtils` describe because that block mocks
// `document.createElement` — which the html() helper here calls, and mocking
// it would recurse. These tests use the real DOM.
describe('shouldIncludeInExport (DOM filter)', () => {
  const html = (markup: string): HTMLElement => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = markup;

    return wrapper.firstElementChild as HTMLElement;
  };

  it('keeps normal DOM elements', () => {
    expect(shouldIncludeInExport(html('<div class="node">card</div>'))).toBe(
      true
    );
    expect(shouldIncludeInExport(html('<span>text</span>'))).toBe(true);
    expect(shouldIncludeInExport(html('<button>click</button>'))).toBe(true);
  });

  it('keeps React Flow handles — OM lineage handles paint a visible box', () => {
    // React Flow's `<Handle>` always adds the base `react-flow__handle`
    // class. OM's CustomNodeV1 wraps it as
    // `<Handle className="lineage-node-handle" .../>`, so real DOM is
    // `react-flow__handle react-flow__handle-right lineage-node-handle`,
    // which `custom-node.less` styles as a visible 20x20 white box with an
    // SVG icon. Filtering by the base class alone would silently drop those
    // visible handles from the exported PNG — regression covered here.
    expect(
      shouldIncludeInExport(
        html(
          '<div class="react-flow__handle react-flow__handle-right lineage-node-handle"></div>'
        )
      )
    ).toBe(true);
    // Even a bare react-flow__handle (no wrapper) must be kept — we cannot
    // tell from the class alone whether it paints.
    expect(
      shouldIncludeInExport(html('<div class="react-flow__handle"></div>'))
    ).toBe(true);
  });

  it('skips handles explicitly opted out via data-export-hide="true"', () => {
    // For handles that truly do not paint (edge-attachment pips on
    // non-lineage react-flow surfaces, for example), the component author
    // must opt in individually — the safe path.
    expect(
      shouldIncludeInExport(
        html('<div class="react-flow__handle" data-export-hide="true"></div>')
      )
    ).toBe(false);
  });

  it('honors data-export-hide="true" as an opt-out', () => {
    expect(
      shouldIncludeInExport(html('<div data-export-hide="true">hidden</div>'))
    ).toBe(false);
    // Only literal "true" — anything else stays included so a partial
    // `data-export-hide` attribute doesn't silently drop content.
    expect(
      shouldIncludeInExport(html('<div data-export-hide="false">v</div>'))
    ).toBe(true);
    expect(
      shouldIncludeInExport(html('<div data-export-hide="">v</div>'))
    ).toBe(true);
  });

  it('skips screen-reader-only content (.sr-only, .visually-hidden)', () => {
    expect(
      shouldIncludeInExport(html('<span class="sr-only">for AT</span>'))
    ).toBe(false);
    expect(
      shouldIncludeInExport(html('<span class="visually-hidden">for AT</span>'))
    ).toBe(false);
  });

  it('passes through non-HTMLElement nodes without inspecting them', () => {
    // SVGElements are Elements but not HTMLElements — filter must return true
    // so SVG lineage icons keep rendering. Guards against a `.classList` /
    // `.dataset` access path that only works on HTMLElement.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    expect(shouldIncludeInExport(svg as unknown as Element)).toBe(true);
  });
});
