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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LinkModal from './LinkModal';

const onSave = jest.fn();
const onCancel = jest.fn();

const defaultProps = {
  isOpen: true,
  data: { href: '' },
  onSave,
  onCancel,
};

describe('LinkModal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the "Add link" title and the link input when href is empty', () => {
    render(<LinkModal {...defaultProps} />);

    expect(screen.getByText('Add link')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render the "Edit link" title when an href is provided', () => {
    render(<LinkModal {...defaultProps} data={{ href: 'https://x.com' }} />);

    expect(screen.getByText('Edit link')).toBeInTheDocument();
  });

  it('should call onSave with the entered href on submit', async () => {
    render(<LinkModal {...defaultProps} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '{{buildEntityUrl event.entityType entity}}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        href: '{{buildEntityUrl event.entityType entity}}',
      })
    );
  });

  it('should call onCancel when the cancel button is clicked', () => {
    render(<LinkModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // Regression: when the editor lives inside a focus-trapping dialog/drawer
  // (e.g. React Aria's SlideoutMenu), the modal must portal INTO that dialog so
  // the dialog's focus scope and useInteractOutside do not steal focus from the
  // input or dismiss the drawer when the modal opens.
  it('should mount the modal inside the container returned by getContainer', () => {
    const host = document.createElement('div');
    host.setAttribute('data-testid', 'dialog-host');
    document.body.appendChild(host);

    render(<LinkModal {...defaultProps} getContainer={() => host} />);

    expect(host.querySelector('.block-editor-link-modal')).toBeInTheDocument();

    document.body.removeChild(host);
  });

  it('should apply a z-index above the React Aria overlay (100000)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    render(<LinkModal {...defaultProps} getContainer={() => host} />);

    const elementsWithZIndex = Array.from(
      host.querySelectorAll<HTMLElement>('*')
    ).filter((element) => element.style.zIndex === '100001');

    expect(elementsWithZIndex.length).toBeGreaterThan(0);

    document.body.removeChild(host);
  });
});
