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
import React from 'react';
import { Team } from '../../../../../../generated/entity/teams/team';
import MembersAssetsTab from './MembersAssetsTab';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '../../../../../Glossary/GlossaryTerms/tabs/AssetsTabs.component',
  () => ({ __esModule: true, default: () => <div data-testid="assets-tabs" /> })
);

jest.mock(
  '../../../../../Explore/EntitySummaryPanel/EntitySummaryPanel.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="summary-panel" />,
  })
);

const baseProps = {
  team: { fullyQualifiedName: 'Engineering' } as Team,
  assetCount: 3,
  permissions: {},
  assetsQueryFilter: {},
  previewAsset: undefined,
  onAddAsset: jest.fn(),
  onAssetClick: jest.fn(),
  onClosePreview: jest.fn(),
} as unknown as React.ComponentProps<typeof MembersAssetsTab>;

describe('MembersAssetsTab', () => {
  it('renders the assets list', async () => {
    render(<MembersAssetsTab {...baseProps} />);

    expect(await screen.findByTestId('assets-tabs')).toBeInTheDocument();
    expect(screen.queryByTestId('summary-panel')).not.toBeInTheDocument();
  });

  it('renders the summary panel when an asset is previewed', async () => {
    render(
      <MembersAssetsTab
        {...baseProps}
        previewAsset={{ id: 'a1' } as never}
      />
    );

    expect(await screen.findByTestId('summary-panel')).toBeInTheDocument();
  });
});
