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
import { Cube01, File02, Settings01, Users01 } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import type { ProgressStepItem } from '../components/application/progress-steps/progress-steps';
import { ProgressSteps } from '../components/application/progress-steps/progress-steps';

const steps: ProgressStepItem[] = [
  { title: 'Your details', description: 'Please provide your name and email' },
  { title: 'Company details', description: 'A few details about your company' },
  {
    title: 'Invite your team',
    description: 'Start collaborating with your team',
  },
  {
    title: 'Add your socials',
    description: 'Share posts to your social accounts',
  },
];

const attachedSteps: ProgressStepItem[] = [
  { title: 'Template' },
  { title: 'Configure' },
  { title: 'Schedule' },
];

const stepsWithIcons: ProgressStepItem[] = [
  { ...steps[0], icon: File02 },
  { ...steps[1], icon: Cube01 },
  { ...steps[2], icon: Users01 },
  { ...steps[3], icon: Settings01 },
];

const meta = {
  title: 'Application/ProgressSteps',
  component: ProgressSteps,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    steps,
    currentStep: 1,
  },
} satisfies Meta<typeof ProgressSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IconCentered: Story = {
  args: { type: 'icon', orientation: 'horizontal' },
};

export const NumberCentered: Story = {
  args: { type: 'number', orientation: 'horizontal' },
};

export const NumberAttached: Story = {
  args: {
    type: 'number',
    orientation: 'horizontal',
    labelPlacement: 'attach',
    steps: attachedSteps,
    currentStep: 0,
  },
};

export const FeaturedIconCentered: Story = {
  args: {
    type: 'featured-icon',
    orientation: 'horizontal',
    steps: stepsWithIcons,
  },
};

export const MinimalDots: Story = {
  args: { type: 'dot', orientation: 'horizontal', showConnector: false },
};

export const MinimalDotsConnected: Story = {
  args: { type: 'dot', orientation: 'horizontal', showConnector: true },
};

export const TextWithLine: Story = {
  args: { type: 'line' },
};

export const IconWithTextVertical: Story = {
  args: { type: 'icon', orientation: 'vertical', steps: stepsWithIcons },
};

export const NumberVertical: Story = {
  args: { type: 'number', orientation: 'vertical' },
};

export const FeaturedIconVertical: Story = {
  args: {
    type: 'featured-icon',
    orientation: 'vertical',
    steps: stepsWithIcons,
  },
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      <ProgressSteps currentStep={1} size="sm" steps={steps} type="number" />
      <ProgressSteps currentStep={1} size="md" steps={steps} type="number" />
      <ProgressSteps currentStep={1} size="lg" steps={steps} type="number" />
    </div>
  ),
};
