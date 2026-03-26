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
import { Edit01, Settings01, Trash01 } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import {
  ButtonGroup,
  ButtonGroupItem,
} from '../components/base/button-group/button-group';

const meta = {
  title: 'Components/ButtonGroup',
  component: ButtonGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupItem id="option1">Option 1</ButtonGroupItem>
      <ButtonGroupItem id="option2">Option 2</ButtonGroupItem>
      <ButtonGroupItem id="option3">Option 3</ButtonGroupItem>
    </ButtonGroup>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ButtonGroup size="sm">
        <ButtonGroupItem id="sm1">Small 1</ButtonGroupItem>
        <ButtonGroupItem id="sm2">Small 2</ButtonGroupItem>
        <ButtonGroupItem id="sm3">Small 3</ButtonGroupItem>
      </ButtonGroup>
      <ButtonGroup size="md">
        <ButtonGroupItem id="md1">Medium 1</ButtonGroupItem>
        <ButtonGroupItem id="md2">Medium 2</ButtonGroupItem>
        <ButtonGroupItem id="md3">Medium 3</ButtonGroupItem>
      </ButtonGroup>
      <ButtonGroup size="lg">
        <ButtonGroupItem id="lg1">Large 1</ButtonGroupItem>
        <ButtonGroupItem id="lg2">Large 2</ButtonGroupItem>
        <ButtonGroupItem id="lg3">Large 3</ButtonGroupItem>
      </ButtonGroup>
    </div>
  ),
};

export const WithIcons: StoryObj = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupItem iconLeading={Edit01} id="edit">
        Edit
      </ButtonGroupItem>
      <ButtonGroupItem iconLeading={Settings01} id="settings">
        Settings
      </ButtonGroupItem>
      <ButtonGroupItem iconLeading={Trash01} id="delete">
        Delete
      </ButtonGroupItem>
    </ButtonGroup>
  ),
};

export const IconOnly: StoryObj = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupItem iconLeading={Edit01} id="edit-icon" />
      <ButtonGroupItem iconLeading={Settings01} id="settings-icon" />
      <ButtonGroupItem iconLeading={Trash01} id="delete-icon" />
    </ButtonGroup>
  ),
};

export const WithDisabled: StoryObj = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupItem id="opt1">Option 1</ButtonGroupItem>
      <ButtonGroupItem isDisabled id="opt2">
        Disabled
      </ButtonGroupItem>
      <ButtonGroupItem id="opt3">Option 3</ButtonGroupItem>
    </ButtonGroup>
  ),
};
