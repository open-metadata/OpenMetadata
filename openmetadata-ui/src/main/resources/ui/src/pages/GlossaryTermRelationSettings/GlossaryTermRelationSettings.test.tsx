/*
 *  Copyright 2025 Collate.
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

import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  RelationCardinality,
  RelationCategory,
} from '../../generated/configuration/glossaryTermRelationSettings';
import {
  getGlossaryTermRelationSettings,
  getRelationTypeUsageCounts,
} from '../../rest/glossaryAPI';
import GlossaryTermRelationSettingsPage from './GlossaryTermRelationSettings';

jest.mock('../../rest/glossaryAPI', () => ({
  getGlossaryTermRelationSettings: jest.fn(),
  getRelationTypeUsageCounts: jest.fn(),
  updateGlossaryTermRelationSettings: jest.fn(),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockReturnValue([]),
}));

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockReturnValue(<div>TitleBreadcrumb</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const SYSTEM_RELATION_TYPE = {
  name: 'relatedTo',
  displayName: 'Related To',
  description: 'General associative relationship',
  isSymmetric: true,
  isTransitive: false,
  isCrossGlossaryAllowed: true,
  category: RelationCategory.Associative,
  isSystemDefined: true,
  // old Ant Design color that was previously stored in the backend
  color: '#1890ff',
  cardinality: RelationCardinality.ManyToMany,
};

const CUSTOM_RELATION_TYPE = {
  name: 'myCustomType',
  displayName: 'My Custom Type',
  description: 'A user-defined relation type',
  isSymmetric: false,
  isTransitive: false,
  isCrossGlossaryAllowed: true,
  category: RelationCategory.Associative,
  isSystemDefined: false,
  color: '#bc1b06',
  cardinality: RelationCardinality.ManyToMany,
};

const renderPage = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <GlossaryTermRelationSettingsPage />
      </MemoryRouter>
    );
  });
};

describe('GlossaryTermRelationSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRelationTypeUsageCounts as jest.Mock).mockResolvedValue({});
  });

  describe('renderColorBadge — system-defined relation types', () => {
    it('shows design-system color label for system-defined type even when backend returns stale Ant Design color', async () => {
      (getGlossaryTermRelationSettings as jest.Mock).mockResolvedValue({
        relationTypes: [SYSTEM_RELATION_TYPE],
      });

      await renderPage();

      // RELATION_META['relatedTo'].color is '#1570ef', which maps to 'label.color-blue' in COLOR_META_BY_HEX.
      // The old backend color '#1890ff' is NOT in COLOR_META_BY_HEX and would fall through to show the raw hex.
      // If the fix is working, we see the translated label key — not the raw stale hex.
      expect(await screen.findByText('label.color-blue')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('#1890ff')).not.toBeInTheDocument();
      });
    });

    it('does not display the raw stale backend hex for system-defined types', async () => {
      (getGlossaryTermRelationSettings as jest.Mock).mockResolvedValue({
        relationTypes: [SYSTEM_RELATION_TYPE],
      });

      await renderPage();

      await waitFor(() => {
        expect(screen.queryByText('#1890ff')).not.toBeInTheDocument();
      });
    });
  });

  describe('renderColorBadge — custom relation types', () => {
    it('shows user-set color for custom (non-system-defined) relation type', async () => {
      (getGlossaryTermRelationSettings as jest.Mock).mockResolvedValue({
        relationTypes: [CUSTOM_RELATION_TYPE],
      });

      await renderPage();

      // '#bc1b06' is in COLOR_META_BY_HEX mapped to 'label.color-orange'
      expect(await screen.findByText('label.color-orange')).toBeInTheDocument();
    });

    it('shows raw hex when custom type color is not in design palette', async () => {
      (getGlossaryTermRelationSettings as jest.Mock).mockResolvedValue({
        relationTypes: [{ ...CUSTOM_RELATION_TYPE, color: '#abcdef' }],
      });

      await renderPage();

      expect(await screen.findByText('#abcdef')).toBeInTheDocument();
    });
  });

  describe('renderColorBadge — no color set', () => {
    it('renders a dash when neither record.color nor RELATION_META has a color for the name', async () => {
      (getGlossaryTermRelationSettings as jest.Mock).mockResolvedValue({
        relationTypes: [
          {
            ...CUSTOM_RELATION_TYPE,
            name: 'unknownType',
            color: undefined,
          },
        ],
      });

      await renderPage();

      expect(await screen.findByText('—')).toBeInTheDocument();
    });
  });
});
