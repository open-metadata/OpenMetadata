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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagChipTooltip } from './TagChipTooltip';

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('TagChipTooltip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the tooltip open for as long as the chip is hovered', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <TagChipTooltip title="Tier.Tier2 description">
        <a href="/tag/Tier.Tier2">Tier2</a>
      </TagChipTooltip>
    );
    const chip = screen.getByText('Tier2');

    // react-aria needs one warm-up hover before the delayed open, as in TopicCard.test.
    await user.hover(chip);
    await advance(1000);
    await user.unhover(chip);
    await user.hover(chip);
    await advance(1000);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Tier.Tier2 description'
    );

    await advance(5000);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.unhover(chip);
    await advance(1000);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
