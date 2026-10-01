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
import ActivityChangePanel from './ActivityChangePanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ActivityChangePanel', () => {
  it('shows only the side an addition has, with its count', () => {
    render(
      <ActivityChangePanel
        change={{
          labelKey: 'label.tag-plural',
          before: [],
          after: ['PII.Sensitive'],
          isText: false,
        }}
      />
    );

    expect(screen.getByText('label.tag-plural')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('+ PII.Sensitive')).toBeInTheDocument();
    expect(
      screen.queryByTestId('activity-change-error')
    ).not.toBeInTheDocument();
  });

  it('puts what was removed beside what was added', () => {
    render(
      <ActivityChangePanel
        change={{
          labelKey: 'label.owner-plural',
          before: ['Ram'],
          after: ['Data Platform team'],
          isText: false,
        }}
      />
    );

    expect(screen.getByTestId('activity-change-error')).toHaveTextContent(
      'label.before− Ram'
    );
    expect(screen.getByTestId('activity-change-success')).toHaveTextContent(
      'label.after+ Data Platform team'
    );
    expect(screen.getByText('−1')).toBeInTheDocument();
  });

  it('shows a description as text, without counts or signs', () => {
    render(
      <ActivityChangePanel
        change={{
          labelKey: 'label.description',
          before: ['Old text'],
          after: ['New text'],
          isText: true,
        }}
      />
    );

    expect(screen.getByText('Old text')).toBeInTheDocument();
    expect(screen.getByText('New text')).toBeInTheDocument();
    expect(screen.queryByText('+1')).not.toBeInTheDocument();
  });
});
