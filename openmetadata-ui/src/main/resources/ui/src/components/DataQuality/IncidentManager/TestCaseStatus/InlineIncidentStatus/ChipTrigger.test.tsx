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
import { createRef } from 'react';
import { ChipTrigger } from './ChipTrigger.component';

jest.mock('@untitledui/icons', () => ({
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronUp: () => <svg data-testid="icon-chevron-up" />,
}));

// jsdom does no layout, so the visual truncation itself is covered by
// playwright/e2e/Features/IncidentManagerLocaleLayout.spec.ts. What is
// verifiable here is the contract truncation depends on: the untruncated label
// must stay in the DOM (accessible name) and be exposed on hover (issue #30522),
// and an unbounded chip must not advertise a tooltip it cannot need.
const LONG_LABEL = 'Критичность инцидента отсутствует';

const renderChip = ({
  chipLabel = LONG_LABEL,
  hasEditPermission = true,
  maxChipWidth,
}: {
  chipLabel?: string;
  hasEditPermission?: boolean;
  maxChipWidth?: string;
} = {}) =>
  render(
    <ChipTrigger
      attachPressHandler={false}
      chipLabel={chipLabel}
      chipRef={createRef<HTMLButtonElement>()}
      dataTestId="severity-chip"
      hasEditPermission={hasEditPermission}
      maxChipWidth={maxChipWidth}
      overlayOpen={false}
      palette={{ bg: '#fff', color: '#000', border: '#ccc' }}
    />
  );

describe('ChipTrigger', () => {
  it('should expose the untruncated label on hover when bounded', () => {
    renderChip({ maxChipWidth: 'tw:max-w-44' });

    expect(screen.getByTestId('severity-chip-label')).toHaveAttribute(
      'title',
      LONG_LABEL
    );
  });

  it('should keep the whole label in the accessible name', () => {
    renderChip({ maxChipWidth: 'tw:max-w-44' });

    expect(screen.getByTestId('severity-chip')).toHaveTextContent(LONG_LABEL);
  });

  it('should expose the label for a bounded chip the user cannot edit', () => {
    renderChip({ hasEditPermission: false, maxChipWidth: 'tw:max-w-44' });

    expect(screen.getByTestId('severity-chip-label')).toHaveAttribute(
      'title',
      LONG_LABEL
    );
    expect(screen.queryByTestId('icon-chevron-down')).not.toBeInTheDocument();
  });

  it('should not set a tooltip on an unbounded chip', () => {
    renderChip();

    expect(screen.getByTestId('severity-chip-label')).not.toHaveAttribute(
      'title'
    );
    expect(screen.getByTestId('severity-chip')).toHaveTextContent(LONG_LABEL);
  });
});
