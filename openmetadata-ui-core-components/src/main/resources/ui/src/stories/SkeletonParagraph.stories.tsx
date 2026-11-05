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
import { SkeletonParagraph } from '../components/base/skeleton/skeleton-paragraph';

const meta = {
  title: 'Components/SkeletonParagraph',
  component: SkeletonParagraph,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: { rows: 3, title: true },
} satisfies Meta<typeof SkeletonParagraph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutTitle: Story = { args: { title: false, rows: 2 } };

export const LightAndDark: Story = {
  parameters: { theme: 'both' },
  render: (args) => (
    <div className="tw:w-80 tw:rounded-xl tw:bg-surface tw:p-4">
      <SkeletonParagraph {...args} />
    </div>
  ),
};
