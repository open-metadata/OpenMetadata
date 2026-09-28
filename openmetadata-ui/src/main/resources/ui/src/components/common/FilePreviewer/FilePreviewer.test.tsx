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

import { render, screen, waitFor } from '@testing-library/react';
import { FileType } from '../../../generated/entity/data/contextFile';
import FilePreviewer from './FilePreviewer';

const createObjectURL = jest.fn(() => 'blob:x');
const revokeObjectURL = jest.fn();

beforeAll(() => {
  (URL as unknown as { createObjectURL: unknown }).createObjectURL =
    createObjectURL;
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL =
    revokeObjectURL;
});

describe('FilePreviewer', () => {
  it('renders the image renderer for png and revokes url on unmount', async () => {
    const { unmount } = render(
      <FilePreviewer
        content={new Blob()}
        fileExtension="png"
        fileName="a.png"
        mimeType="image/png"
      />
    );
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('renders svg through the image renderer (safe via <img> src)', async () => {
    render(
      <FilePreviewer
        content={new Blob()}
        fileType={FileType.Image}
        mimeType="image/svg+xml"
      />
    );

    expect(await screen.findByRole('img')).toBeInTheDocument();
  });
});
