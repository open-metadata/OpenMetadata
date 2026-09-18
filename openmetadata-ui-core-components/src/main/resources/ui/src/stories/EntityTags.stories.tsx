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
import { ClassificationTag } from '../components/application/tag/classification-tag';
import { DataProductTag } from '../components/application/tag/data-product-tag';
import { DomainTag } from '../components/application/tag/domain-tag';
import { GlossaryTag } from '../components/application/tag/glossary-tag';

const meta = {
  title: 'Application/EntityTags',
  component: ClassificationTag,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ClassificationTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'PII.Sensitive',
  },
};

export const Variants: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ClassificationTag color="#7F56D9" label="PII.Sensitive" />
      <GlossaryTag color="#2E90FA" label="Customer" />
      <DomainTag color="#12B76A" label="Engineering" />
      <DataProductTag color="#F79009" label="Reporting Suite" />
    </div>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <ClassificationTag color="#7F56D9" label="Extra small" size="xs" />
      <ClassificationTag color="#7F56D9" label="Small" size="sm" />
      <ClassificationTag color="#7F56D9" label="Medium" size="md" />
    </div>
  ),
};

export const WithCustomIcon: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ClassificationTag color="#7F56D9" icon="Tag01" label="Custom icon" />
    </div>
  ),
};

export const WithHref: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ClassificationTag
        color="#7F56D9"
        href="/classification/pii"
        label="Links to detail page"
      />
    </div>
  ),
};

export const WithDelete: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ClassificationTag
        color="#7F56D9"
        label="Removable"
        onDelete={() => {
          console.log('deleted');
        }}
      />
    </div>
  ),
};

export const WithTooltip: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ClassificationTag
        color="#7F56D9"
        label="Hover me"
        tooltip="This tag has a tooltip"
      />
    </div>
  ),
};

export const Disabled: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ClassificationTag disabled color="#7F56D9" label="Disabled" />
    </div>
  ),
};
