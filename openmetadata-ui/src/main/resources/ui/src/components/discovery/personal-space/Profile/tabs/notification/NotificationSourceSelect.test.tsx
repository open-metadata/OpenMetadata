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
import { SourceKind } from '../../../../../../generated/events/api/alertCapabilities';
import type { UseAlertCapabilitiesReturn } from '../../../../../../hooks/useAlertCapabilities';
import NotificationSourceSelect from './NotificationSourceSelect';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityNameLabel: (name: string) => `Label of ${name}`,
}));

jest.mock('../../../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIconWithBg: jest.fn(() => null),
  },
}));

const CAPABILITIES: UseAlertCapabilitiesReturn = {
  knownSources: ['table', 'dashboard', 'topic'].map((name) => ({
    name,
    kind: SourceKind.Entity,
  })),
  loading: false,
  settled: true,
  retry: jest.fn(),
};

describe('NotificationSourceSelect', () => {
  it('shows every source the alert watches, not only the first', () => {
    render(
      <NotificationSourceSelect
        capabilities={CAPABILITIES}
        value={['table', 'dashboard']}
      />
    );

    const sources = screen.getByTestId('source-select');

    expect(sources).toHaveTextContent('Label of table');
    expect(sources).toHaveTextContent('Label of dashboard');
    expect(sources).not.toHaveTextContent('Label of topic');
  });

  it('does not let the sources change', () => {
    render(
      <NotificationSourceSelect capabilities={CAPABILITIES} value={['table']} />
    );

    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
