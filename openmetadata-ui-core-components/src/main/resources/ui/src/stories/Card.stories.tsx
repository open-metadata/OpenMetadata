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
import { Card } from '../components/base/card/card';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card>
      <div className="tw:p-6">
        <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
          Card title
        </h2>
        <p className="tw:mt-2 tw:text-sm tw:text-secondary">
          This is a basic card with default styles applied.
        </p>
      </div>
    </Card>
  ),
};

export const WithImage: Story = {
  render: () => (
    <Card>
      <div className="tw:h-40 tw:bg-gradient-to-br tw:from-blue-400 tw:to-purple-500" />
      <div className="tw:p-6">
        <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
          Card with image
        </h2>
        <p className="tw:mt-2 tw:text-sm tw:text-secondary">
          Content below an image that overflows the card edges cleanly due to
          overflow-hidden.
        </p>
      </div>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card>
      <div className="tw:p-6">
        <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
          Card with footer
        </h2>
        <p className="tw:mt-2 tw:text-sm tw:text-secondary">
          Cards can contain any content including headers, body text, and
          footers.
        </p>
      </div>
      <div className="tw:border-t tw:border-secondary tw:px-6 tw:py-4">
        <p className="tw:text-xs tw:text-tertiary">Footer content</p>
      </div>
    </Card>
  ),
};

export const CustomWidth: Story = {
  render: () => (
    <Card className="tw:max-w-80">
      <div className="tw:p-6">
        <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
          Narrower card
        </h2>
        <p className="tw:mt-2 tw:text-sm tw:text-secondary">
          The max-width can be overridden via className.
        </p>
      </div>
    </Card>
  ),
};
