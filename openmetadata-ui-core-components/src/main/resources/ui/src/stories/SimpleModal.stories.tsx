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
import { useState } from 'react';
import { Button } from '../components/base/buttons/button';
import { SimpleModal } from '../components/application/modals/simple-modal';

const meta = {
  title: 'Components/SimpleModal',
  component: SimpleModal,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    isOpen: false,
    title: 'Delete glossary term',
    onCancel: () => undefined,
    children: 'This action cannot be undone.',
  },
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <>
        <Button onPress={() => setIsOpen(true)}>Open modal</Button>
        <SimpleModal
          {...args}
          isOpen={isOpen}
          onCancel={() => setIsOpen(false)}
          onOk={() => setIsOpen(false)}
        />
      </>
    );
  },
} satisfies Meta<typeof SimpleModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  args: { okButtonColor: 'primary-destructive', okText: 'Delete' },
};

export const Loading: Story = {
  args: { isOkLoading: true },
};

export const NoFooter: Story = {
  args: { footer: null, width: 480 },
};

export const Dark: Story = {
  parameters: { theme: 'dark' },
};
