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
import InlineEmptyPlaceholder from './InlineEmptyPlaceholder';

describe('InlineEmptyPlaceholder', () => {
  it('shows the title and the hint in the default box', () => {
    render(
      <InlineEmptyPlaceholder
        data-testid="empty"
        description="Link this concept to an external vocabulary."
        title="No mappings yet."
      />
    );

    const box = screen.getByTestId('empty');

    expect(box).toHaveTextContent('No mappings yet.');
    expect(box).toHaveTextContent(
      'Link this concept to an external vocabulary.'
    );
  });

  it('shows only the title as one line in the text variant', () => {
    render(
      <InlineEmptyPlaceholder
        data-testid="empty"
        description="ignored"
        title="No relationships yet."
        variant="text"
      />
    );

    const line = screen.getByTestId('empty');

    expect(line.tagName).toBe('P');
    expect(line).toHaveTextContent('No relationships yet.');
    expect(line).not.toHaveTextContent('ignored');
  });
});
