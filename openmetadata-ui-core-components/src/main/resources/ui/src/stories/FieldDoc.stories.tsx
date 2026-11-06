/*
 *  Copyright 2025 Collate.
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
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { useForm } from 'react-hook-form';
import { getField } from '../components/application/form-field/form-field';
import { FieldTypes } from '../components/application/form-field/form-field.types';
import { HookForm } from '../components/base/form/hook-form';

const DOC = 'Documentation body for the title field.';

const Demo = ({ showFieldDocs = false }: { showFieldDocs?: boolean }) => {
  const form = useForm({ defaultValues: { title: '' } });

  // The field-doc popover is anchored to the right of the focused field
  // (placement="right top"), matching how the real forms render it inside a
  // constrained modal/drawer. Cap the form width here so the popover has room
  // to show on the right instead of being pushed off the full-width canvas.
  return (
    <div style={{ maxWidth: 420 }}>
      <HookForm form={form} showFieldDocs={showFieldDocs}>
        {getField({
          name: 'title',
          label: 'Title',
          id: 'title',
          type: FieldTypes.TEXT,
          doc: DOC,
        })}
      </HookForm>
    </div>
  );
};

const meta: Meta<typeof Demo> = {
  title: 'Application/FieldDoc',
  component: Demo,
};

export default meta;

type Story = StoryObj<typeof Demo>;

export const ShowsDocOnFocus: Story = {
  args: { showFieldDocs: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox'));
    const body = within(document.body);

    expect(await body.findByText(DOC)).toBeInTheDocument();
  },
};

export const HiddenWhenDisabled: Story = {
  args: { showFieldDocs: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox'));

    expect(within(document.body).queryByText(DOC)).not.toBeInTheDocument();
  },
};
