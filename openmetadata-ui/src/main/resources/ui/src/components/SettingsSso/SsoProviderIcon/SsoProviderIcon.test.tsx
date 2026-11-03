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

import { render, screen } from '@testing-library/react';
import SsoProviderIcon from './SsoProviderIcon';

const CoreIcon = ({ size }: { size?: number }) => (
  <svg data-size={size} data-testid="core-icon" />
);

describe('SsoProviderIcon', () => {
  it('renders an image URL as an img with alt text and size', () => {
    render(<SsoProviderIcon alt="Google" icon="/google.png" size={22} />);

    const img = screen.getByRole('img', { name: 'Google' });

    expect(img).toHaveAttribute('src', '/google.png');
    expect(img).toHaveAttribute('width', '22');
    expect(img).toHaveAttribute('height', '22');
  });

  it('renders a core icon component at the requested size', () => {
    render(<SsoProviderIcon icon={CoreIcon} size={22} />);

    expect(screen.getByTestId('core-icon')).toHaveAttribute('data-size', '22');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('defaults to a 24px icon', () => {
    render(<SsoProviderIcon icon={CoreIcon} />);

    expect(screen.getByTestId('core-icon')).toHaveAttribute('data-size', '24');
  });

  it('falls back to an img for non-component imports', () => {
    // Jest mocks image imports as objects rather than URL strings.
    const mockedImport = { src: 'file' } as unknown as string;

    const { container } = render(<SsoProviderIcon icon={mockedImport} />);

    expect(container.querySelector('img')).toBeInTheDocument();
    expect(screen.queryByTestId('core-icon')).not.toBeInTheDocument();
  });
});
