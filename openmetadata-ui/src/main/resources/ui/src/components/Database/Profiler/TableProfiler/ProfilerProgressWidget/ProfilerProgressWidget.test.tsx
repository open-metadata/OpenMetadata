/*
 *  Copyright 2022 Collate.
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

import { cleanup, render, screen } from '@testing-library/react';
import { ProfilerProgressWidgetProps } from '../TableProfiler.interface';
import ProfilerProgressWidget from './ProfilerProgressWidget';

const mockProps: ProfilerProgressWidgetProps = {
  value: 0.2,
};

describe('Test ProfilerProgressWidget component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render without crashing', async () => {
    render(<ProfilerProgressWidget {...mockProps} />);

    const container = await screen.findByTestId(
      'profiler-progress-bar-container'
    );
    const percentInfo = await screen.findByTestId('percent-info');
    const progressBar = await screen.findByTestId('progress-bar');

    expect(container).toBeInTheDocument();
    expect(percentInfo).toBeInTheDocument();
    expect(percentInfo.textContent).toBe(
      `${Math.round(mockProps.value * 100)}%`
    );
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '20'
    );
  });

  it('should put the percentage after the bar and apply strokeColor when direction is right', () => {
    render(
      <ProfilerProgressWidget
        direction="right"
        strokeColor="var(--om-color-success-500)"
        value={0.5}
      />
    );

    const container = screen.getByTestId('profiler-progress-bar-container');

    expect(container).toHaveClass('tw:flex-row-reverse');
    expect(container.style.getPropertyValue('--progress-stroke')).toBe(
      'var(--om-color-success-500)'
    );
    expect(screen.getByRole('progressbar').firstElementChild).toHaveClass(
      'tw:bg-(--progress-stroke)'
    );
  });
});
