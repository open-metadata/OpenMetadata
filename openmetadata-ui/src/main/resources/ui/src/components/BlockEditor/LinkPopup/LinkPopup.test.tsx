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
import { fireEvent, render, screen } from '@testing-library/react';
import LinkPopup from './LinkPopup';

const handleLinkToggle = jest.fn();
const handleUnlink = jest.fn();

const defaultProps = {
  href: 'https://example.com',
  handleLinkToggle,
  handleUnlink,
};

describe('LinkPopup', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the edit, open, and unlink actions', () => {
    render(<LinkPopup {...defaultProps} />);

    expect(screen.getByTestId('link-popup-edit')).toBeInTheDocument();
    expect(screen.getByTestId('link-popup-open')).toBeInTheDocument();
    expect(screen.getByTestId('link-popup-unlink')).toBeInTheDocument();
  });

  it('should point the open action at the href in a new tab', () => {
    render(<LinkPopup {...defaultProps} />);

    const open = screen.getByTestId('link-popup-open');

    expect(open).toHaveAttribute('href', 'https://example.com');
    expect(open).toHaveAttribute('target', '_blank');
  });

  it('should call handleLinkToggle when edit is clicked', () => {
    render(<LinkPopup {...defaultProps} />);

    fireEvent.click(screen.getByTestId('link-popup-edit'));

    expect(handleLinkToggle).toHaveBeenCalledTimes(1);
  });

  it('should call handleUnlink when unlink is clicked', () => {
    render(<LinkPopup {...defaultProps} />);

    fireEvent.click(screen.getByTestId('link-popup-unlink'));

    expect(handleUnlink).toHaveBeenCalledTimes(1);
  });
});
