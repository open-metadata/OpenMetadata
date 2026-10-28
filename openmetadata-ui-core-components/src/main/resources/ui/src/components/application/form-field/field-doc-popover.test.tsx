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
import { describe, expect, it } from 'vitest';
import { FieldDocProvider, useFieldDoc } from './field-doc-context';
import type { FieldDocPopoverVariant } from './field-doc-popover';
import { FieldDocPopover } from './field-doc-popover';

const DocumentedField = () => {
  const fieldDoc = useFieldDoc({ name: 'name', label: 'Name', doc: 'Docs' });

  return (
    <div {...fieldDoc}>
      <input aria-label="Name" />
    </div>
  );
};

const renderPopover = async (variant?: FieldDocPopoverVariant) => {
  render(
    <FieldDocProvider enabled>
      <DocumentedField />
      <FieldDocPopover variant={variant} />
    </FieldDocProvider>
  );
  await userEvent.click(screen.getByLabelText('Name'));

  return (await screen.findByRole('note')).parentElement;
};

describe('FieldDocPopover variant', () => {
  it('uses the overlay surface by default', async () => {
    const card = await renderPopover();

    expect(card).toHaveClass('tw:bg-overlay-surface');
  });

  it('muted variant sits on primary_alt like a muted Card', async () => {
    const card = await renderPopover('muted');

    expect(card).toHaveClass('tw:bg-primary_alt');
    expect(card).not.toHaveClass('tw:bg-overlay-surface');
  });
});
