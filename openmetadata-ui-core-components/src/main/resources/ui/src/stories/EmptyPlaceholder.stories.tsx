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
import { Folder, Plus, Stars01, UploadCloud01 } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import { EmptyPlaceholder } from '../components/application/empty-placeholder/empty-placeholder';

const meta = {
  title: 'Components/EmptyPlaceholder',
  component: EmptyPlaceholder,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          width: 960,
          height: 620,
          border: '1px solid var(--color-border-secondary)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['blank', 'features'],
      table: { type: { summary: '"blank" | "features"' } },
    },
    width: {
      control: 'number',
      table: { type: { summary: 'number | string' } },
    },
    icon: { control: false },
    features: { control: false },
    actions: { control: false },
    footer: { control: false },
  },
} satisfies Meta<typeof EmptyPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

const DashboardIcon = (
  <svg
    className="tw:text-fg-brand-primary"
    fill="none"
    height="31"
    viewBox="0 0 34 31"
    width="34"
    xmlns="http://www.w3.org/2000/svg">
    <rect
      height="29"
      rx="6"
      stroke="currentColor"
      strokeWidth="2"
      width="32"
      x="1"
      y="1"
    />
    <path
      d="M23.8158 22V16.6471M17.5 22V14.3529M11.1842 22L11.1842 18.9412M18.6105 10.5504L22.6909 12.0326M16.5517 10.836L12.1318 14.0469M24.6532 11.6301C25.1156 12.078 25.1156 12.8043 24.6532 13.2523C24.1907 13.7002 23.4409 13.7002 22.9784 13.2523C22.516 12.8043 22.516 12.078 22.9784 11.6301C23.4409 11.1821 24.1907 11.1821 24.6532 11.6301ZM12.0216 13.9242C12.484 14.3722 12.484 15.0984 12.0216 15.5464C11.5591 15.9943 10.8093 15.9943 10.3468 15.5464C9.88438 15.0984 9.88438 14.3722 10.3468 13.9242C10.8093 13.4762 11.5591 13.4762 12.0216 13.9242ZM18.3374 9.33597C18.7998 9.78392 18.7998 10.5102 18.3374 10.9582C17.8749 11.4061 17.1251 11.4061 16.6626 10.9582C16.2002 10.5102 16.2002 9.78392 16.6626 9.33597C17.1251 8.88801 17.8749 8.88801 18.3374 9.33597Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const retrievalFeatures = [
  {
    key: 'upload',
    icon: <UploadCloud01 className="tw:size-7 tw:text-fg-brand-primary" />,
    title: 'Upload files',
    description: 'Drag in the documents your team already relies on.',
  },
  {
    key: 'organize',
    icon: <Folder className="tw:size-7 tw:text-fg-warning-primary" />,
    title: 'Organize with folders',
    description: 'Group by topic or team so knowledge stays easy to manage.',
  },
  {
    key: 'retrieve',
    icon: <Stars01 className="tw:size-7 tw:text-fg-success-primary" />,
    title: 'AI retrieves the rest',
    description:
      'Uploaded content is indexed and cited in answers automatically.',
  },
];

export const Blank: Story = {
  args: {
    variant: 'blank',
    icon: DashboardIcon,
    title: "You haven't created a dashboard yet",
    description:
      'Dashboards you create or own will live here. Start one now, or explore what your team has already built in All Dashboards.',
    actions: [
      {
        key: 'new-dashboard',
        label: 'New Dashboard',
        color: 'primary' as const,
        iconLeading: Plus,
      },
    ],
  },
};

export const BlankTextOnly: Story = {
  args: {
    variant: 'blank',
    title: 'Nothing here',
    description: 'This space is empty for now.',
  },
};

export const BlankWithoutTitle: Story = {
  args: {
    variant: 'blank',
    icon: DashboardIcon,
    description:
      'Dashboards you create or own will live here. Start one now, or explore what your team has already built in All Dashboards.',
    actions: [
      {
        key: 'new-dashboard',
        label: 'New Dashboard',
        color: 'primary' as const,
        iconLeading: Plus,
      },
    ],
  },
};

export const Features: Story = {
  args: {
    variant: 'features',
    title: 'Your files, ready for AI retrieval',
    description:
      'Upload the documents your organization already has — PDFs, specs, guides — and they become searchable knowledge the AI can cite.',
    features: retrievalFeatures,
    actions: [
      {
        key: 'article',
        label: 'New Article',
        color: 'primary' as const,
        iconLeading: Plus,
      },
      {
        key: 'folder',
        label: 'New Folder',
        color: 'secondary' as const,
        iconLeading: Plus,
      },
    ],
  },
};

export const FeaturesCustomFooter: Story = {
  args: {
    variant: 'features',
    title: 'Your files, ready for AI retrieval',
    description: 'Bring your own footer with any content you like.',
    features: retrievalFeatures,
    footer: (
      <a className="tw:text-sm tw:text-fg-brand-primary" href="#">
        Learn how AI retrieval works
      </a>
    ),
  },
};
