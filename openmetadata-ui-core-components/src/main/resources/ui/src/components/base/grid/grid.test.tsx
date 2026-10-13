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
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Grid } from './grid';

describe('Grid', () => {
  it('forwards its DOM ref for measured widget containers', () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <Grid ref={ref}>
        <Grid.Item>Widget</Grid.Item>
      </Grid>
    );

    expect(ref.current).toBe(container.firstChild);
  });

  it('allows responsive classes when no explicit span is supplied', () => {
    const { getByTestId } = render(
      <Grid>
        <Grid.Item className="tw:min-[768px]:col-span-12" data-testid="item">
          Widget
        </Grid.Item>
      </Grid>
    );
    const item = getByTestId('item');

    expect(item).toHaveClass('tw:col-span-full', 'tw:min-[768px]:col-span-12');
    expect(item.style.gridColumn).toBe('');
  });

  it('keeps explicit spans clamped to the remaining columns', () => {
    const { getByTestId } = render(
      <Grid>
        <Grid.Item data-testid="item" span={30} start={20}>
          Widget
        </Grid.Item>
      </Grid>
    );

    expect(getByTestId('item').style.gridColumn).toBe('20 / span 5');
  });
});
