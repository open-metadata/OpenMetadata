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
  describe('downloadImageFromBase64', () => {
    let mockCreateElement: jest.SpyInstance;
    let mockSetAttribute: jest.Mock;
    let mockClick: jest.Mock;

    beforeEach(() => {
      mockSetAttribute = jest.fn();
      mockClick = jest.fn();
      mockCreateElement = jest
        .spyOn(document, 'createElement')
        .mockReturnValue({
          setAttribute: mockSetAttribute,
          click: mockClick,
        } as unknown as HTMLAnchorElement);
    });

    afterEach(() => {
      mockCreateElement.mockRestore();
    });

    it('should create and trigger download with correct attributes', () => {
      const dataUrl = 'data:image/png;base64,test';
      const fileName = 'test-image';
      const exportType = ExportTypes.PNG;

      downloadImageFromBase64(dataUrl, fileName, exportType);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockSetAttribute).toHaveBeenCalledWith(
        'download',
        'test-image.png'
      );
      expect(mockSetAttribute).toHaveBeenCalledWith('href', dataUrl);
      expect(mockClick).toHaveBeenCalled();
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

    beforeEach(() => {
      // Mock document.querySelector
      document.querySelector = jest.fn().mockReturnValue(mockElement);

      // Mock toPng
      (toPng as jest.Mock).mockResolvedValue('data:image/png;base64,test');
    });

    afterEach(() => {
      jest.clearAllMocks();
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
  });
});
