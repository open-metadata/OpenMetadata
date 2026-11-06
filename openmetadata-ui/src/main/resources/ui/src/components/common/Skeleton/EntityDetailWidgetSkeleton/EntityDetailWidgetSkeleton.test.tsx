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
import { EntityDetailWidgetSkeleton } from './EntityDetailWidgetSkeleton.component';

const SKELETON_TEST_ID = 'entity-detail-widget-skeleton';

describe('EntityDetailWidgetSkeleton', () => {
  it('fills the reserved widget container', () => {
    render(<EntityDetailWidgetSkeleton />);

    expect(screen.getByTestId(SKELETON_TEST_ID)).toHaveClass(
      'tw:h-full',
      'tw:w-full'
    );
  });

  it('renders two visible animated placeholders', () => {
    const { container } = render(<EntityDetailWidgetSkeleton />);
    const placeholders = container.querySelectorAll('.tw\\:animate-pulse');

    expect(placeholders).toHaveLength(2);

    placeholders.forEach((placeholder) => {
      expect(placeholder).toHaveStyle({ height: '1.2em' });
    });
  });

  it('supports a custom line count for larger widgets', () => {
    const { container } = render(<EntityDetailWidgetSkeleton lineCount={5} />);

    expect(container.querySelectorAll('.tw\\:animate-pulse')).toHaveLength(5);
  });
});
