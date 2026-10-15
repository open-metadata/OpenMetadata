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
import { fireEvent, render, screen } from '@testing-library/react';
import DqDateRangeFilter from './DqDateRangeFilter';

const START_TS = new Date('2024-01-15T00:00:00Z').getTime();
const END_TS = new Date('2024-01-20T00:00:00Z').getTime();

/**
 * Integration tests against the real react-aria-components `DateRangePicker`
 * (no `jest.mock`). They exercise the close-event chain — Escape and Dismiss —
 * that the component's reset-on-close logic must intercept even when used
 * uncontrolled (no `isOpen` / `onOpenChange` props), which is how all three
 * production callers (`DqFilterBar`, `IncidentGroupsFilters`, `TestSummary`)
 * mount it.
 */
describe('DqDateRangeFilter integration', () => {
  it('uncontrolled: reverts abandoned selection to the committed range after Escape close', () => {
    const onApply = jest.fn();
    render(
      <DqDateRangeFilter endTs={END_TS} startTs={START_TS} onApply={onApply} />
    );

    const trigger = screen.getByRole('button', { name: /date range/i });
    const committedText = trigger.textContent ?? '';

    expect(committedText).toContain('Jan 15, 2024');

    fireEvent.click(trigger);

    const todayPreset = screen.getByText('Today');
    fireEvent.click(todayPreset);

    const stagedText = trigger.textContent ?? '';

    expect(stagedText).not.toBe(committedText); // staged != committed

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onApply).not.toHaveBeenCalled();
    // After fix: trigger reverts to the committed range, not the abandoned one.
    expect(trigger.textContent).not.toBe(stagedText);
    expect(trigger.textContent).toBe(committedText);
  }, 30000);

  it('uncontrolled: reverts abandoned selection to the committed range after Dismiss close', () => {
    const onApply = jest.fn();
    render(
      <DqDateRangeFilter endTs={END_TS} startTs={START_TS} onApply={onApply} />
    );

    const trigger = screen.getByRole('button', { name: /date range/i });
    const triggerTextBefore = trigger.textContent ?? '';

    fireEvent.click(trigger);

    const todayPreset = screen.getByText('Today');
    fireEvent.click(todayPreset);

    const triggerTextAfterStaging = trigger.textContent ?? '';

    const dismissButtons = screen.getAllByLabelText('Dismiss');
    fireEvent.click(dismissButtons[0]);

    const triggerTextAfterClose = trigger.textContent ?? '';

    expect(onApply).not.toHaveBeenCalled();
    // After fix: trigger reverts to the committed range, not the staged one.
    expect(triggerTextAfterClose).not.toBe(triggerTextAfterStaging);
    expect(triggerTextAfterClose).toBe(triggerTextBefore);
  }, 30000);

  it('uncontrolled: Cancel then close reverts to the committed range', () => {
    const onApply = jest.fn();
    render(
      <DqDateRangeFilter endTs={END_TS} startTs={START_TS} onApply={onApply} />
    );

    const trigger = screen.getByRole('button', { name: /date range/i });
    const committedText = trigger.textContent ?? '';

    fireEvent.click(trigger);

    const todayPreset = screen.getByText('Today');
    fireEvent.click(todayPreset);

    expect(trigger.textContent).not.toBe(committedText);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onApply).not.toHaveBeenCalled();
    // Cancel reverts the staged value; the close it triggers must not undo that.
    expect(trigger.textContent).toBe(committedText);
  }, 30000);
});
