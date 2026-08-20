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
// must stay in the DOM (accessible name) and be exposed on hover (issue #30522).
const LONG_LABEL = 'Критичность инцидента отсутствует';

const renderChip = (chipLabel: string, hasEditPermission = true) =>
  render(
    <ChipTrigger
      truncateLabel
      attachPressHandler={false}
      chipLabel={chipLabel}
      chipRef={createRef<HTMLButtonElement>()}
      dataTestId="severity-chip"
      hasEditPermission={hasEditPermission}
      overlayOpen={false}
      palette={{ bg: '#fff', color: '#000', border: '#ccc' }}
    />
  );

describe('ChipTrigger', () => {
  it('should expose the untruncated label on hover', () => {
    renderChip(LONG_LABEL);

    expect(screen.getByTestId('severity-chip-label')).toHaveAttribute(
      'title',
      LONG_LABEL
    );
  });

  it('should keep the whole label in the accessible name', () => {
    renderChip(LONG_LABEL);

    expect(screen.getByTestId('severity-chip')).toHaveTextContent(LONG_LABEL);
  });

  it('should expose the label for a chip the user cannot edit', () => {
    renderChip(LONG_LABEL, false);

    expect(screen.getByTestId('severity-chip-label')).toHaveAttribute(
      'title',
      LONG_LABEL
    );
    expect(screen.queryByTestId('icon-chevron-down')).not.toBeInTheDocument();
  });
});
