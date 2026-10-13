import type { Meta, StoryObj } from '@storybook/react';
import { DatePicker } from '@/components/application/date-picker/date-picker';
import { Label } from '@/components/base/input/label';
import { Input } from '@/components/base/input/input';

const meta: Meta<typeof DatePicker> = {
  title: 'Application/DatePicker',
  component: DatePicker,
};

export default meta;

type Story = StoryObj<typeof DatePicker>;

export const ButtonTrigger: Story = {
  render: () => (
    <div className="tw:w-150 tw:p-6">
      <DatePicker aria-label="Start date" />
    </div>
  ),
};

/** The announcement form's layout: two pickers in a labelled column under a text field. */
export const InputTrigger: Story = {
  render: () => (
    <div className="tw:flex tw:w-150 tw:flex-col tw:gap-5 tw:p-6">
      <Input isRequired label="Title" placeholder="Enter Title" />
      <div className="tw:flex tw:gap-4">
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
          <Label isRequired>Start Date</Label>
          <DatePicker aria-label="Start date" triggerVariant="input" />
        </div>
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
          <Label isRequired>End Date</Label>
          <DatePicker aria-label="End date" triggerVariant="input" />
        </div>
      </div>
    </div>
  ),
};
