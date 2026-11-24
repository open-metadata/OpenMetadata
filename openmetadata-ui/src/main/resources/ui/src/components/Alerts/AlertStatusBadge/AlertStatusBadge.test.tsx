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
import AlertStatusBadge from './AlertStatusBadge';

jest.mock('@openmetadata/ui-core-components', () => ({
  BadgeWithDot: jest.fn(
    ({ children, color }: { children: React.ReactNode; color: string }) => (
      <span data-color={color} data-testid="badge-with-dot">
        {children}
      </span>
    )
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('AlertStatusBadge', () => {
  it('shows a gray Disabled badge for an alert that is switched off', () => {
    render(<AlertStatusBadge enabled={false} />);

    expect(screen.getByTestId('alert-status-badge')).toHaveTextContent(
      'label.disabled'
    );
    expect(screen.getByTestId('badge-with-dot')).toHaveAttribute(
      'data-color',
      'gray'
    );
  });

  it.each([true, undefined])(
    'shows a green Active badge for an alert whose enabled flag is %s',
    (enabled) => {
      render(<AlertStatusBadge enabled={enabled} />);

      expect(screen.getByTestId('alert-status-badge')).toHaveTextContent(
        'label.active'
      );
      expect(screen.getByTestId('badge-with-dot')).toHaveAttribute(
        'data-color',
        'success'
      );
    }
  );
});
