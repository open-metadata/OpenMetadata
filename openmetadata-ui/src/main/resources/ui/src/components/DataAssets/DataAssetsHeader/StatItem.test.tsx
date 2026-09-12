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
import { StatItem } from './StatItem.component';

describe('StatItem', () => {
  it('uses one accessible trigger for the tooltip and action', () => {
    const onClick = jest.fn();

    render(
      <StatItem
        count={3}
        srLabel="Open metric tasks"
        testId="tasks"
        tooltip="Tasks"
        onClick={onClick}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Open metric tasks' });

    expect(trigger.querySelectorAll('button')).toHaveLength(0);

    fireEvent.click(trigger);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('prevents actions while loading', () => {
    const onClick = jest.fn();

    render(
      <StatItem
        loading
        srLabel="Open metric tasks"
        testId="tasks"
        tooltip="Tasks"
        onClick={onClick}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Open metric tasks' });

    expect(trigger).toBeDisabled();

    fireEvent.click(trigger);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not expose an enabled action when no click handler exists', () => {
    render(
      <StatItem
        count={3}
        srLabel="Metric tasks"
        testId="tasks"
        tooltip="Tasks"
      />
    );

    expect(screen.getByRole('button', { name: 'Metric tasks' })).toBeDisabled();
  });
});
