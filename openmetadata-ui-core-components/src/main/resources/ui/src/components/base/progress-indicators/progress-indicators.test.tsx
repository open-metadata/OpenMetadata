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
import { ProgressBar } from './progress-indicators';

describe('ProgressBar', () => {
  it('retains chart-series colors through the labeled component', () => {
    render(<ProgressBar color="#123456" labelPosition="right" value={42} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '42'
    );
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({
      backgroundColor: '#123456',
    });
    expect(screen.getByText('42%')).toBeInTheDocument();
  });
});
