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
import { ReactNode } from 'react';

jest.mock(
  'components/Glossary/GlossaryTerms/tabs/AssetsTabs.component',
  () => ({ __esModule: true, default: () => <div data-testid="assets-tabs" /> })
);

jest.mock(
  'components/Explore/EntitySummaryPanel/EntitySummaryPanel.component',
  () => ({ __esModule: true, default: () => <div /> })
);

jest.mock('constants/constants', () => ({ ROUTES: {} }));

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { User } from 'generated/entity/teams/user';
import MyDataAssetsList from './MyDataAssetsList';

describe('MyDataAssetsList', () => {
  it('renders the owned-assets tab with the empty summary state', () => {
    render(<MyDataAssetsList userData={{ id: 'u1', name: 'harsh' } as User} />);

    expect(screen.getByTestId('assets-tabs')).toBeInTheDocument();
    // Right column shows the empty state until an asset is selected.
    expect(screen.getByText('label.no-entity-found')).toBeInTheDocument();
  });
});
