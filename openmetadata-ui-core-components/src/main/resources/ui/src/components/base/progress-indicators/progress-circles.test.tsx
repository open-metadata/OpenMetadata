/*
 *  Copyright 2023 Collate.
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

describe('ProgressBarCircle', () => {
  it('preserves status colors on the circle and value', () => {
    const { container } = render(
      <ProgressBarCircle color="success" size="xxs" value={25} />
    );

    expect(container.querySelectorAll('circle')[1]).toHaveClass(
      'tw:stroke-fg-success-primary'
    );
    expect(screen.getByText('25%')).toHaveClass('tw:text-success-primary');
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '25'
    );
  });
});
