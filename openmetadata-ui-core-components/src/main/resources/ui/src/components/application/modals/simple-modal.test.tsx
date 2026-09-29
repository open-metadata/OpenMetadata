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
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SimpleModal } from './simple-modal';

describe('SimpleModal', () => {
  it('renders title, body and default footer wired to onOk / onCancel', async () => {
    const onOk = vi.fn();
    const onCancel = vi.fn();
    render(
      <SimpleModal isOpen title="Delete" onCancel={onCancel} onOk={onOk}>
        Body text
      </SimpleModal>
    );

    expect(screen.getByRole('heading', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'label.ok' }));
    await userEvent.click(screen.getByRole('button', { name: 'label.cancel' }));

    expect(onOk).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on Escape', async () => {
    const onCancel = vi.fn();
    render(<SimpleModal isOpen title="T" onCancel={onCancel} />);

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables OK and uses custom labels', () => {
    render(
      <SimpleModal
        isOkDisabled
        isOpen
        cancelText="No"
        okText="Yes"
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Yes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No' })).toBeEnabled();
  });

  it('hides the footer when footer is null and renders a custom footer', () => {
    const { rerender } = render(
      <SimpleModal isOpen footer={null} onCancel={vi.fn()} />
    );

    expect(screen.queryByRole('button', { name: 'label.ok' })).toBeNull();

    rerender(
      <SimpleModal isOpen footer={<span>Custom</span>} onCancel={vi.fn()} />
    );

    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'label.ok' })).toBeNull();
  });

  it('renders nothing when closed', () => {
    render(<SimpleModal isOpen={false} title="T" onCancel={vi.fn()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
