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
import { AxiosError } from 'axios';
import { ROUTES } from '../constants/constants';
import type { ContextFile } from '../generated/entity/data/contextFile';
import { PageType } from '../interface/knowledge-center.interface';
import { downloadDriveFile } from '../rest/assetAPI';
import {
  downloadBlob,
  formatBytes,
  handleAssetDownload,
  knowledgePageToArticleItem,
} from './ContextCenterPureUtils';
import { showErrorToast } from './ToastUtils';

jest.mock('./ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../rest/assetAPI', () => ({
  downloadDriveFile: jest.fn(),
}));

jest.mock('./KnowledgePageUtils', () => ({
  getContextCenterArticlePath: jest.fn(),
}));

jest.mock('crypto-random-string-with-promisify-polyfill', () =>
  jest.fn(() => 'random123')
);

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

describe('handleAssetDownload', () => {
  const mockFile = {
    id: '123',
    name: 'sample.pdf',
  };

  const mockBlob = new Blob(['test'], { type: 'application/pdf' });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    global.URL.createObjectURL = jest.fn(() => 'blob:url');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should create a download link for a blob', () => {
    const clickMock = jest.fn();
    const removeMock = jest.fn();
    const anchorElement = {
      click: clickMock,
      remove: removeMock,
    } as unknown as HTMLAnchorElement;

    const appendChildSpy = jest
      .spyOn(document.body, 'appendChild')
      .mockImplementation(() => ({} as unknown as Node));

    jest.spyOn(document, 'createElement').mockReturnValue(anchorElement);

    downloadBlob(mockBlob, 'download-name.pdf');

    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(anchorElement.href).toBe('blob:url');
    expect(anchorElement.download).toBe('download-name.pdf');
    expect(appendChildSpy).toHaveBeenCalledWith(anchorElement);
    expect(clickMock).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
  });

  it('should download asset successfully', async () => {
    (downloadDriveFile as jest.Mock).mockResolvedValue(mockBlob);

    const clickMock = jest.fn();
    const removeMock = jest.fn();
    const anchorElement = {
      click: clickMock,
      remove: removeMock,
    } as unknown as HTMLAnchorElement;

    const appendChildSpy = jest
      .spyOn(document.body, 'appendChild')
      .mockImplementation(() => ({} as unknown as Node));

    jest.spyOn(document, 'createElement').mockReturnValue(anchorElement);

    await handleAssetDownload(mockFile as unknown as ContextFile);

    expect(downloadDriveFile).toHaveBeenCalledWith('123');

    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);

    expect(anchorElement.download).toBe('sample.pdf');

    expect(appendChildSpy).toHaveBeenCalledWith(anchorElement);

    expect(clickMock).toHaveBeenCalled();

    expect(removeMock).toHaveBeenCalled();

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
  });

  it('should show error toast when download fails', async () => {
    const error = new Error('Download failed');

    (downloadDriveFile as jest.Mock).mockRejectedValue(error);

    await handleAssetDownload(mockFile as unknown as ContextFile);

    expect(showErrorToast).toHaveBeenCalledWith(error as AxiosError);
  });
});
