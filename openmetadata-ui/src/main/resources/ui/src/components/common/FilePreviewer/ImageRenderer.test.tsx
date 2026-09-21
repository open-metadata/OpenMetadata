/*
 *  Copyright OpenMetadata Collective SPDX-License-Identifier: Apache-2.0
 */

import { render, screen } from '@testing-library/react';
import ImageRenderer from './ImageRenderer';

describe('ImageRenderer', () => {
  it('renders an img with the object url and alt', () => {
    render(
      <ImageRenderer
        content={new Blob()}
        fileName="pic.png"
        objectUrl="blob:test-url"
      />
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'blob:test-url');
    expect(img).toHaveAttribute('alt', 'pic.png');
  });
});
