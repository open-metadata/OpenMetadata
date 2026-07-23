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
import { expect, userEvent, waitFor, within } from '@storybook/test';
import { Dialog as AriaDialog } from 'react-aria-components';
import { PopoverTrigger } from '../components/application/popover/popover';
import { Button } from '../components/base/buttons/button';
import { Popover as SelectPopover } from '../components/base/select/popover';

const POPOVER_LABEL = 'Select popover';
const TRIGGER_LABEL = 'Open select popover';

interface SelectPopoverExampleProps {
  isDismissable: boolean;
  shouldCloseOnInteractOutside?: (element: Element) => boolean;
  showFilteredOutsideActions?: boolean;
}

// Keeps the trigger and popover markup identical so each story isolates only
// the outside-interaction configuration it demonstrates.
const SelectPopoverExample = ({
  isDismissable,
  shouldCloseOnInteractOutside,
  showFilteredOutsideActions = false,
}: SelectPopoverExampleProps) => (
  <div className="tw:flex tw:items-center tw:gap-4">
    <PopoverTrigger>
      <Button color="secondary">{TRIGGER_LABEL}</Button>
      <SelectPopover
        isNonModal
        isDismissable={isDismissable}
        shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
        size="sm">
        <AriaDialog
          aria-label={POPOVER_LABEL}
          className="tw:min-w-60 tw:p-4 tw:outline-hidden">
          Use the outside actions to test this popover.
        </AriaDialog>
      </SelectPopover>
    </PopoverTrigger>

    {showFilteredOutsideActions ? (
      <>
        <Button color="tertiary">Ignored outside action</Button>
        <Button data-dismiss-popover color="tertiary">
          Dismiss outside action
        </Button>
      </>
    ) : (
      <Button color="tertiary">Outside action</Button>
    )}
  </div>
);

const meta = {
  title: 'Components/SelectPopover',
  component: SelectPopover,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SelectPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

// Enabling dismissal without a custom filter closes the popover for any
// interaction outside the popover and its trigger.
export const Dismissible: Story = {
  render: () => <SelectPopoverExample isDismissable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: TRIGGER_LABEL }));
    expect(
      await body.findByRole('dialog', { name: POPOVER_LABEL })
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Outside action' })
    );
    await waitFor(() =>
      expect(
        body.queryByRole('dialog', { name: POPOVER_LABEL })
      ).not.toBeInTheDocument()
    );
  },
};

// This filter acts as an allow-list: only the explicitly marked outside action
// may dismiss the popover.
const shouldCloseOnMarkedOutsideAction = (element: Element) =>
  element.closest('[data-dismiss-popover]') !== null;

// Demonstrates that ignored outside targets keep the popover open while an
// approved outside target closes it.
export const FilteredOutsideInteraction: Story = {
  render: () => (
    <SelectPopoverExample
      isDismissable
      showFilteredOutsideActions
      shouldCloseOnInteractOutside={shouldCloseOnMarkedOutsideAction}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: TRIGGER_LABEL }));
    expect(
      await body.findByRole('dialog', { name: POPOVER_LABEL })
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Ignored outside action' })
    );
    expect(
      body.getByRole('dialog', { name: POPOVER_LABEL })
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Dismiss outside action' })
    );
    await waitFor(() =>
      expect(
        body.queryByRole('dialog', { name: POPOVER_LABEL })
      ).not.toBeInTheDocument()
    );
  },
};

// Disabling dismissal and rejecting every outside target keeps the popover
// open after outside interaction.
export const NonDismissible: Story = {
  render: () => (
    <SelectPopoverExample
      isDismissable={false}
      shouldCloseOnInteractOutside={() => false}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const trigger = canvas.getByRole('button', {
      name: TRIGGER_LABEL,
    });

    await userEvent.click(trigger);
    expect(
      await body.findByRole('dialog', { name: POPOVER_LABEL })
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Outside action' })
    );
    expect(
      body.getByRole('dialog', { name: POPOVER_LABEL })
    ).toBeInTheDocument();
  },
};
