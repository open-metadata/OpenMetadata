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
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { useForm } from 'react-hook-form';
import { getField } from '../components/application/form-field/form-field';
import { FieldTypes } from '../components/application/form-field/form-field.types';
import { HookForm } from '../components/base/form/hook-form';

const TITLE_DOC = 'Documentation body for the title field.';
const OWNER_DOC = 'Documentation body for the owner field.';
const EMPTY = 'Select a field to see its hint.';

const Demo = ({ showFieldDocs = true }: { showFieldDocs?: boolean }) => {
  const form = useForm({ defaultValues: { title: '', owner: '' } });

  // The panel is a real column inside the form surface, so unlike the popover
  // story this needs a bounded height to exercise the column's own scrolling.
  return (
    <div style={{ height: 320 }}>
      <HookForm
        emptyFieldDoc={EMPTY}
        fieldDocDisplay="panel"
        form={form}
        showFieldDocs={showFieldDocs}>
        {getField({
          name: 'title',
          label: 'Title',
          id: 'title',
          type: FieldTypes.TEXT,
          doc: TITLE_DOC,
        })}
        {getField({
          name: 'owner',
          label: 'Owner',
          id: 'owner',
          type: FieldTypes.TEXT,
          doc: OWNER_DOC,
        })}
      </HookForm>
    </div>
  );
};

const meta: Meta<typeof Demo> = {
  title: 'Application/FieldDocPanel',
  component: Demo,
};

export default meta;

type Story = StoryObj<typeof Demo>;

export const ShowsEmptyStateBeforeFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(await canvas.findByText(EMPTY)).toBeInTheDocument();
  },
};

export const ShowsDocOnFocusAndSwapsOnRefocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Title'));

    expect(await canvas.findByText(TITLE_DOC)).toBeInTheDocument();

    await userEvent.click(canvas.getByLabelText('Owner'));

    expect(await canvas.findByText(OWNER_DOC)).toBeInTheDocument();
    expect(canvas.queryByText(TITLE_DOC)).not.toBeInTheDocument();
  },
};

export const HiddenWhenDisabled: Story = {
  args: { showFieldDocs: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Title'));

    expect(canvas.queryByText(TITLE_DOC)).not.toBeInTheDocument();
    expect(canvas.queryByText(EMPTY)).not.toBeInTheDocument();
  },
};
