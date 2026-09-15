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
import { Owner } from './owner';

describe('Owner empty placeholder', () => {
  it('renders the no-owner-icon for the compact empty placeholder', () => {
    render(<Owner owners={[]} placeHolder="No Assignee" />);

    expect(screen.getByTestId('no-owner-icon')).toBeInTheDocument();
  });

  it('does not render the no-owner-icon when an owner is present', () => {
    render(
      <Owner
        owners={[
          { id: 'u1', name: 'user1', displayName: 'User One', type: 'user' },
        ]}
      />
    );

    expect(screen.queryByTestId('no-owner-icon')).not.toBeInTheDocument();
  });
});
