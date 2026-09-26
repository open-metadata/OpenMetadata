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

jest.mock('../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'me' } }),
}));

jest.mock(
  '../../../../../components/common/ProfilePicture/ProfilePicture',
  () => ({
    __esModule: true,
    default: () => <span />,
  })
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import TaskDetailSummary from './TaskDetailSummary';

describe('TaskDetailSummary', () => {
  // The viewer is named as themselves, e.g. "harsh.soni (You)".
  it('marks the viewer in a people row', () => {
    render(
      <TaskDetailSummary
        rows={[
          {
            key: 'approver',
            icon: 'user',
            label: 'Approver',
            value: {
              kind: 'users',
              refs: [
                { id: 'me', type: 'user', name: 'harsh' },
                { id: 'other', type: 'user', name: 'dana' },
              ],
            },
          },
        ]}
      />
    );

    expect(screen.getByText('harsh (label.you)')).toBeInTheDocument();
    expect(screen.getByText('dana')).toBeInTheDocument();
  });
});
