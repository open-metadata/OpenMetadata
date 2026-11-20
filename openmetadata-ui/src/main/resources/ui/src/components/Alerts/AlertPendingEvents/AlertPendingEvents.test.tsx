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
import userEvent from '@testing-library/user-event';
import AlertPendingEvents from './AlertPendingEvents';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('AlertPendingEvents', () => {
  it('says a disabled alert is not running instead of showing 0', () => {
    render(
      <AlertPendingEvents counts={{ enabled: false, pendingEventsCount: 0 }} />
    );

    expect(screen.getByTestId('alert-not-running')).toHaveTextContent(
      'label.not-running'
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('explains in a tooltip that a disabled alert processes no events', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <AlertPendingEvents counts={{ enabled: false, pendingEventsCount: 0 }} />
    );

    await user.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'message.disabled-alert-processes-no-events'
    );
  });

  it('shows the pending count of an enabled alert, with + when it is a lower bound', () => {
    render(
      <AlertPendingEvents
        counts={{
          countsAreLowerBound: true,
          enabled: true,
          pendingEventsCount: 500,
        }}
      />
    );

    expect(screen.getByText('500+')).toBeInTheDocument();
    expect(screen.queryByTestId('alert-not-running')).not.toBeInTheDocument();
  });
});
