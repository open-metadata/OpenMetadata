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
import { render } from '@testing-library/react';
import { AxiosError } from 'axios';
import { ROUTES } from 'constants/constants';
import { Asset } from 'generated/attachments/asset';
import { PageType } from 'interface/knowledge-center.interface';
import { downloadAsset } from 'rest/assetAPI';
import {
  assetToDocumentItem,
  extensionToFileType,
  formatBytes,
  getFileTypeIcon,
  handleAssetDownload,
  knowledgePageToArticleItem,
} from './ContextCenterUtils';
import { showErrorToast } from './ToastUtils';

jest.mock('./ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../rest/assetAPI', () => ({
  downloadAsset: jest.fn(),
}));

jest.mock('./KnowledgePageUtils', () => ({
  getContextCenterArticlePath: jest.fn(),
}));

jest.mock('crypto-random-string-with-promisify-polyfill', () =>
  jest.fn(() => 'random123')
);

describe('extensionToFileType', () => {
  it('should return doc for doc/docx files', () => {
    expect(extensionToFileType('test.doc')).toBe('doc');
    expect(extensionToFileType('test.docx')).toBe('doc');
  });

  it('should return pdf for pdf files', () => {
    expect(extensionToFileType('test.pdf')).toBe('pdf');
  });

  it('should return xls for spreadsheet files', () => {
    expect(extensionToFileType('test.xls')).toBe('xls');
    expect(extensionToFileType('test.xlsx')).toBe('xls');
    expect(extensionToFileType('test.csv')).toBe('xls');
  });

  it('should return image for image files', () => {
    expect(extensionToFileType('test.png')).toBe('image');
    expect(extensionToFileType('test.jpeg')).toBe('image');
  });

  it('should return other for unsupported files', () => {
    expect(extensionToFileType('test.zip')).toBe('other');
  });

  it('should return other when extension is missing', () => {
    expect(extensionToFileType('test')).toBe('other');
  });
});

describe('formatBytes', () => {
  it('should return empty string for undefined', () => {
    expect(formatBytes()).toBe('');
  });

  it('should format bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('should format KB correctly', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('should format MB correctly', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('assetToDocumentItem', () => {
  it('should transform asset into UploadedDocumentItem', () => {
    const asset = {
      id: '1',
      fileName: 'sample.pdf',
      size: 2048,
    };

    expect(assetToDocumentItem(asset as Asset)).toEqual({
      fileType: 'pdf',
      id: '1',
      name: 'sample.pdf',
      sizeLabel: '2.0 KB',
      status: 'processed',
    });
  });
});

describe('knowledgePageToArticleItem', () => {
  it('should map article page correctly', () => {
    const page = {
      id: '1',
      displayName: 'My Article',
      description: 'Description',
      updatedAt: 123456,
      fullyQualifiedName: 'sample.article',
      tags: [{ tagFQN: 'Tier.Tier1' }],
      pageType: PageType.ARTICLE,
    };

    expect(knowledgePageToArticleItem(page, 'Untitled')).toEqual({
      description: 'Description',
      href: `${ROUTES.CONTEXT_CENTER_ARTICLES}/sample.article`,
      id: '1',
      lastEditedAt: 123456,
      tags: [{ label: 'Tier1' }],
      title: 'My Article',
    });
  });

  it('should map quick link correctly', () => {
    const page = {
      id: '2',
      updatedAt: 123,
      pageType: PageType.QUICK_LINK,
      page: {
        url: 'https://example.com',
      },
    };

    expect(knowledgePageToArticleItem(page, 'Untitled')).toEqual({
      description: '',
      href: 'https://example.com',
      id: '2',
      lastEditedAt: 123,
      tags: [],
      title: 'Untitled',
    });
  });
});

describe('getFileTypeIcon', () => {
  it('should render default icon for unknown type', () => {
    const { container } = render(getFileTypeIcon('unknown'));

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should render icon component for pdf type', () => {
    expect(getFileTypeIcon('pdf')).toBeTruthy();
  });
});

describe('handleAssetDownload', () => {
  const mockFile = {
    id: '123',
    name: 'sample.pdf',
  };

  const mockBlob = new Blob(['test'], { type: 'application/pdf' });

  beforeEach(() => {
    jest.clearAllMocks();

    global.URL.createObjectURL = jest.fn(() => 'blob:url');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('should download asset successfully', async () => {
    (downloadAsset as jest.Mock).mockResolvedValue(mockBlob);

    const clickMock = jest.fn();
    const removeMock = jest.fn();

    const appendChildSpy = jest
      .spyOn(document.body, 'appendChild')
      .mockImplementation(() => ({}) as unknown as Node);

    jest.spyOn(document, 'createElement').mockReturnValue({
      click: clickMock,
      remove: removeMock,
    } as unknown as HTMLAnchorElement);

    await handleAssetDownload(mockFile as any);

    expect(downloadAsset).toHaveBeenCalledWith('123');

    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);

    expect(appendChildSpy).toHaveBeenCalled();

    expect(clickMock).toHaveBeenCalled();

    expect(removeMock).toHaveBeenCalled();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
  });

  it('should show error toast when download fails', async () => {
    const error = new Error('Download failed');

    (downloadAsset as jest.Mock).mockRejectedValue(error);

    await handleAssetDownload(mockFile as any);

    expect(showErrorToast).toHaveBeenCalledWith(error as AxiosError);
  });
});
