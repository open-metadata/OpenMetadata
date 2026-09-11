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

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBarCircle } from './progress-circles';
import { ProgressBar } from './progress-indicators';

describe('progress indicator accessibility', () => {
  it('exposes the name and count of a labelled progress bar', () => {
    render(
      <>
        <span id="progress-title">Required checks</span>
        <ProgressBar
          aria-labelledby="progress-title"
          labelPosition="right"
          max={3}
          value={2}
        />
      </>
    );
    const progress = screen.getByRole('progressbar', {
      name: 'Required checks',
    });
    expect(progress).toHaveAttribute('aria-valuenow', '2');
    expect(progress).toHaveAttribute('aria-valuemax', '3');
  });
  it('uses the circle label as its accessible name', () => {
    render(
      <ProgressBarCircle label="Your checks" max={4} size="xxs" value={1} />
    );
    expect(
      screen.getByRole('progressbar', { name: 'Your checks' })
    ).toHaveAttribute('aria-valuenow', '1');
  });
});
