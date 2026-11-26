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
import { render, waitFor } from '@testing-library/react';
import { NodeViewProps } from '@tiptap/react';
import { useInView } from 'react-intersection-observer';
import { downloadAsset } from '../../../../rest/assetAPI';
import FileNodeView from './FileNodeView';

jest.mock('react-intersection-observer', () => ({
  useInView: jest.fn(),
}));

jest.mock('../../../../rest/assetAPI', () => ({
  downloadAsset: jest.fn().mockResolvedValue(new Blob(['data'])),
}));

const mockUseInView = useInView as jest.Mock;
const mockDownloadAsset = downloadAsset as jest.Mock;

const buildProps = (attrs: Record<string, unknown>) =>
  ({
    node: {
      attrs: {
        url: '/api/v1/attachments/abc-123/download?direct=false',
        fileName: 'file',
        fileSize: 1024,
        isUploading: false,
        tempFile: null,
        isImage: false,
        ...attrs,
      },
    },
    editor: { isEditable: false },
    updateAttributes: jest.fn(),
    deleteNode: jest.fn(),
  } as unknown as NodeViewProps);

const setInView = (inView: boolean) =>
  mockUseInView.mockReturnValue({ ref: jest.fn(), inView });

describe('FileNodeView attachment downloads', () => {
  beforeAll(() => {
    URL.createObjectURL = jest.fn().mockReturnValue('blob:mock');
    URL.revokeObjectURL = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not download a plain file attachment on render', () => {
    setInView(true);
    render(<FileNodeView {...buildProps({ mimeType: 'application/pdf' })} />);

    expect(mockDownloadAsset).not.toHaveBeenCalled();
  });

  it('defers an image download until it scrolls into view', async () => {
    setInView(false);
    const imageAttrs = { mimeType: 'image/png', isImage: true };
    const { rerender } = render(<FileNodeView {...buildProps(imageAttrs)} />);

    expect(mockDownloadAsset).not.toHaveBeenCalled();

    setInView(true);
    rerender(<FileNodeView {...buildProps(imageAttrs)} />);

    await waitFor(() => expect(mockDownloadAsset).toHaveBeenCalledTimes(1));
  });

  it('downloads a video attachment once it is in view', async () => {
    setInView(true);
    render(<FileNodeView {...buildProps({ mimeType: 'video/mp4' })} />);

    await waitFor(() =>
      expect(mockDownloadAsset).toHaveBeenCalledWith('abc-123')
    );
  });
});
