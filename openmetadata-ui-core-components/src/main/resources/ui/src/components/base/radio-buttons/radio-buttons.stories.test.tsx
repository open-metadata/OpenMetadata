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
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as RadioButtonsStories from '../../../stories/RadioButtons.stories';

describe('RadioButtons.stories', () => {
  it('does not export the removed StandaloneButtons story', () => {
    expect(RadioButtonsStories).not.toHaveProperty('StandaloneButtons');
  });

  it('exports only the supported RadioGroup-backed stories', () => {
    const named = Object.keys(RadioButtonsStories)
      .filter((key) => key !== 'default')
      .sort();

    expect(named).toEqual(['Default', 'Sizes', 'WithDisabled', 'WithHints']);
  });

  it('renders the Default story without throwing', () => {
    const story = RadioButtonsStories.Default;

    expect(() => render(story.render({ ...story.args }))).not.toThrow();
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('renders the Sizes story without throwing', () => {
    const story = RadioButtonsStories.Sizes;

    expect(() => render(story.render())).not.toThrow();
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
    expect(screen.getAllByText('Option A')).toHaveLength(2);
    expect(screen.getAllByText('Option B')).toHaveLength(2);
    expect(screen.getAllByText('Option C')).toHaveLength(2);
  });

  it('renders the WithHints story without throwing', () => {
    const story = RadioButtonsStories.WithHints;

    expect(() => render(story.render())).not.toThrow();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(
      screen.getByText('Up to 5 users, 10 GB storage')
    ).toBeInTheDocument();
  });

  it('renders the WithDisabled story without throwing', () => {
    const story = RadioButtonsStories.WithDisabled;

    expect(() => render(story.render())).not.toThrow();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByLabelText('Disabled option')).toBeDisabled();
  });
});
