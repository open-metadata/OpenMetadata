/*
 *  Copyright OpenMetadata Collective SPDX-License-Identifier: Apache-2.0
 */

import { render, screen, waitFor } from '@testing-library/react';
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

  it('renders unsupported for svg', async () => {
    render(
      <FilePreviewer
        content={new Blob()}
        fileExtension="svg"
        mimeType="image/svg+xml"
      />
    );

    expect(await screen.findByText(/download/i)).toBeInTheDocument();
  });
});
