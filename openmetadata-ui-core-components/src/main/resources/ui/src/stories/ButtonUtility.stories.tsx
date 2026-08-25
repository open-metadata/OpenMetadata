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
import { Edit01, HelpCircle, InfoCircle, Trash01 } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import { ButtonUtility } from '../components/base/buttons/button-utility';

const meta = {
  title: 'Components/ButtonUtility',
  component: ButtonUtility,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ButtonUtility>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: Edit01,
    color: 'secondary',
    size: 'sm',
    tooltip: 'Edit',
  },
};

export const Colors: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <ButtonUtility color="secondary" icon={Edit01} tooltip="Secondary" />
      <ButtonUtility color="tertiary" icon={Edit01} tooltip="Tertiary" />
    </div>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <ButtonUtility icon={Edit01} size="xs" tooltip="Extra Small" />
      <ButtonUtility icon={Edit01} size="sm" tooltip="Small" />
    </div>
  ),
};

export const WithTooltip: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <ButtonUtility icon={Edit01} tooltip="Edit" />
      <ButtonUtility icon={HelpCircle} tooltip="Help" />
      <ButtonUtility icon={InfoCircle} tooltip="Info" />
      <ButtonUtility icon={Trash01} tooltip="Delete" />
    </div>
  ),
};

export const Disabled: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <ButtonUtility isDisabled icon={Edit01} tooltip="Edit (disabled)" />
      <ButtonUtility isDisabled icon={Trash01} tooltip="Delete (disabled)" />
    </div>
  ),
};
