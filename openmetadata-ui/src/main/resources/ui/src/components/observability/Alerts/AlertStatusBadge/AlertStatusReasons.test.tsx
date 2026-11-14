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
import AlertStatusReasons from './AlertStatusReasons';

describe('AlertStatusReasons', () => {
  it('puts each reason on a line of its own, each section under its heading', () => {
    render(
      <AlertStatusReasons
        sections={[
          { title: 'unusable', reasons: ['first value', 'second value'] },
          { title: 'label.failure-reason', reasons: ['refused'] },
        ]}
      />
    );

    expect(
      screen
        .getAllByTestId('alert-status-reason-line')
        .map((line) => line.textContent)
    ).toEqual(['first value', 'second value', 'refused']);
    expect(screen.getByText('label.failure-reason')).toBeInTheDocument();
  });
});
