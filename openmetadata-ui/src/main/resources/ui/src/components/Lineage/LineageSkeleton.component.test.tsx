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
import { LineageSkeleton } from './LineageSkeleton.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('LineageSkeleton', () => {
  it('renders an accessible Untitled UI graph placeholder', () => {
    render(<LineageSkeleton />);

    expect(screen.getByRole('status', { name: 'label.loading' })).toBeVisible();
    expect(screen.getAllByTestId('lineage-skeleton-node')).toHaveLength(3);
  });
});
