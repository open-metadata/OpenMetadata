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
import { useRef, useState } from 'react';
import { ConfirmPopover } from '../components/application/confirm-popover/confirm-popover';
import { Button } from '../components/base/buttons/button';
import { ButtonUtility } from '../components/base/buttons/button-utility';
import { Input } from '../components/base/input/input';
import { Trash01 } from '../icons';

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 1000));

const meta = {
  title: 'Components/ConfirmPopover',
  component: ConfirmPopover,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof ConfirmPopover>;

export default meta;

export const Delete: StoryObj = {
  render: () => (
    <ConfirmPopover
      description="All its metadata will be removed. This can't be undone."
      title="Delete Collate Support Policy?"
      onConfirm={wait}>
      <ButtonUtility
        color="tertiary"
        icon={Trash01}
        size="xs"
        tooltip="Delete"
      />
    </ConfirmPopover>
  ),
};

export const SoftOrHardDelete: StoryObj = {
  render: () => (
    <ConfirmPopover
      actions={[{ key: 'soft', label: 'Soft delete', onPress: wait }]}
      description="Soft delete hides it and can be restored. Delete removes it forever."
      title='Delete "jane.doe"?'
      onConfirm={wait}>
      <ButtonUtility
        color="tertiary"
        icon={Trash01}
        size="xs"
        tooltip="Delete"
      />
    </ConfirmPopover>
  ),
};

export const WithContent: StoryObj = {
  render: () => (
    <ConfirmPopover
      confirmText="Test"
      content={<Input label="Email" placeholder="Enter email" />}
      title="Test email connection"
      variant="primary"
      onConfirm={wait}>
      <Button color="secondary">Test email</Button>
    </ConfirmPopover>
  ),
};

export const AnchoredToRef: StoryObj = {
  render: () => {
    const ControlledExample = () => {
      const ref = useRef<HTMLButtonElement>(null);
      const [isOpen, setIsOpen] = useState(false);

      return (
        <>
          <Button ref={ref} onPress={() => setIsOpen(true)}>
            Open from a menu action
          </Button>
          <ConfirmPopover
            description="Uninstalling removes the application."
            isOpen={isOpen}
            title="Uninstall Data Retention?"
            triggerRef={ref}
            onConfirm={wait}
            onOpenChange={setIsOpen}
          />
        </>
      );
    };

    return <ControlledExample />;
  },
};
