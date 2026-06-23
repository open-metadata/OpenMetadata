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
import { toPng } from 'html-to-image';
import { ExportData } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { ExportTypes } from '../../constants/Export.constants';
import { showErrorToast } from '../ToastUtils';
import {
  downloadFile,
  downloadImageFromBase64,
  exportPNGImageFromElement,
} from './ExportUtils';

jest.mock('html-to-image', () => ({
  toPng: jest.fn(),
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

    beforeEach(() => {
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

  describe('downloadImageFromBase64', () => {
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
      downloadImageFromBase64(
        'data:image/png;base64,dGVzdA==',
        'test-image',
        ExportTypes.PNG
      );

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalledTimes(1);
    });

    it('sets the correct download filename with lowercased extension', () => {
      downloadImageFromBase64(
        'data:image/png;base64,dGVzdA==',
        'my_chart',
        ExportTypes.PNG
      );

      expect(mockLink.download).toBe('my_chart.png');
    });

    it('hides the link element', () => {
      downloadImageFromBase64(
        'data:image/png;base64,dGVzdA==',
        'test-image',
        ExportTypes.PNG
      );

      expect(mockLink.style.visibility).toBe('hidden');
    });

    it('appends and removes the link from the DOM', () => {
      downloadImageFromBase64(
        'data:image/png;base64,dGVzdA==',
        'test-image',
        ExportTypes.PNG
      );

      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });

    it('creates a blob URL from the decoded base64 data', () => {
      downloadImageFromBase64(
        'data:image/png;base64,dGVzdA==',
        'test-image',
        ExportTypes.PNG
      );

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(mockLink.href).toBe('blob:mock-png-url');
    });

    it('revokes the object URL after download', () => {
      downloadImageFromBase64(
        'data:image/png;base64,dGVzdA==',
        'test-image',
        ExportTypes.PNG
      );

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-png-url');
    });

    it('uses the MIME type parsed from the data URL when creating the Blob', () => {
      const mockBlob = {};
      const MockBlob = jest.fn().mockReturnValue(mockBlob);
      global.Blob = MockBlob as unknown as typeof Blob;

      downloadImageFromBase64(
        'data:image/jpeg;base64,dGVzdA==',
        'test-image',
        ExportTypes.PNG
      );

      expect(MockBlob).toHaveBeenCalledWith(expect.any(Array), {
        type: 'image/jpeg',
      });
    });

    it('falls back to image/png when the data URL has no MIME type', () => {
      const mockBlob = {};
      const MockBlob = jest.fn().mockReturnValue(mockBlob);
      global.Blob = MockBlob as unknown as typeof Blob;

      downloadImageFromBase64('data:,dGVzdA==', 'test-image', ExportTypes.PNG);

      expect(MockBlob).toHaveBeenCalledWith(expect.any(Array), {
        type: 'image/png',
      });
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

    let mockCompositeCtx: Record<string, jest.Mock | string | number>;
    let mockCompositeCanvas: HTMLCanvasElement;
    let mockImg: HTMLImageElement;

    beforeEach(() => {
      document.querySelector = jest.fn().mockReturnValue(mockElement);
      (toPng as jest.Mock).mockResolvedValue('data:image/png;base64,nodes');

      mockCompositeCtx = {
        fillStyle: '',
        fillRect: jest.fn(),
        drawImage: jest.fn(),
      };
      mockCompositeCanvas = {
        width: 0,
        height: 0,
        getContext: jest.fn().mockReturnValue(mockCompositeCtx),
        toDataURL: jest.fn().mockReturnValue('data:image/png;base64,composite'),
      } as unknown as HTMLCanvasElement;

      mockImg = { onload: null, onerror: null } as unknown as HTMLImageElement;
      Object.defineProperty(mockImg, 'src', {
        set(_src: string) {
          // Fire onload as a microtask — by this point loadImage has already
          // assigned img.onload = resolve, so the promise resolves correctly.
          Promise.resolve().then(() => {
            (mockImg.onload as unknown as (() => void) | null)?.();
          });
        },
        configurable: true,
      });
      global.Image = jest
        .fn()
        .mockImplementation(() => mockImg) as unknown as typeof Image;

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

    it('should successfully export PNG image when element exists', async () => {
      await exportPNGImageFromElement(mockExportData);

      expect(document.querySelector).toHaveBeenCalledWith('#test-element');
      expect(toPng).toHaveBeenCalledWith(
        mockElement,
        expect.objectContaining({
          backgroundColor: '#ffffff',
          width: 1240, // 1200 + (20 * 2) padding
          height: 940, // 900 + (20 * 2) padding
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

    it('should throw error when element is not found', async () => {
      document.querySelector = jest.fn().mockReturnValue(null);

      await expect(exportPNGImageFromElement(mockExportData)).rejects.toThrow(
        'message.error-generating-export-type'
      );
    });

    it('should handle viewport transformation when provided', async () => {
      const exportDataWithViewport = {
        ...mockExportData,
        viewport: {
          x: 100,
          y: 200,
          zoom: 1.5,
        },
      };

      await exportPNGImageFromElement(exportDataWithViewport);

      expect(toPng).toHaveBeenCalledWith(
        mockElement,
        expect.objectContaining({
          style: expect.objectContaining({
            transform: 'translate(100px, 200px) scale(1.5)',
          }),
        })
      );
    });

    it('should handle toPng error', async () => {
      const error = new Error('PNG generation failed');
      (toPng as jest.Mock).mockRejectedValue(error);

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

        expect(toPng).toHaveBeenCalledWith(
          mockElement,
          expect.objectContaining({ backgroundColor: undefined })
        );
      });

      it('uses white background when no renderEdgesOverlay (non-composite path)', async () => {
        await exportPNGImageFromElement(mockExportData);

        expect(toPng).toHaveBeenCalledWith(
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
          3 // pixelRatio
        );
      });

      it('fills composite canvas with white background before drawing', async () => {
        await exportPNGImageFromElement(exportDataWithEdges);

        expect(mockCompositeCtx.fillStyle).toBe('#ffffff');
        expect(mockCompositeCtx.fillRect).toHaveBeenCalledWith(
          0,
          0,
          (1200 + 40) * 3,
          (900 + 40) * 3
        );
      });

      it('draws edges before nodes so edges appear behind node cards', async () => {
        await exportPNGImageFromElement(exportDataWithEdges);

        const drawCalls = (mockCompositeCtx.drawImage as jest.Mock).mock.calls;

        // First drawImage call must be the edges canvas
        expect(drawCalls[0][0]).toBe(mockEdgesCanvas);
        // Second drawImage call must be the nodes image
        expect(drawCalls[1][0]).toBe(mockImg);
      });

      it('uses the composite toDataURL for download, not the transparent nodes image', async () => {
        await exportPNGImageFromElement(exportDataWithEdges);

        // composite.toDataURL() must have been called — this is what gets downloaded
        expect(mockCompositeCanvas.toDataURL).toHaveBeenCalledWith(
          'image/png',
          1.0
        );
      });

      it('produces a usable white-background image when edgesCanvas is null', async () => {
        const exportDataNullEdges: ExportData = {
          ...mockExportData,
          renderEdgesOverlay: jest.fn().mockReturnValue(null),
        };

        await exportPNGImageFromElement(exportDataNullEdges);

        // White fill must still happen so no transparent fallback
        expect(mockCompositeCtx.fillRect).toHaveBeenCalled();

        // Only the nodes image is drawn — no edges canvas
        const drawCalls = (mockCompositeCtx.drawImage as jest.Mock).mock.calls;

        expect(drawCalls).toHaveLength(1);
        expect(drawCalls[0][0]).toBe(mockImg);
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
