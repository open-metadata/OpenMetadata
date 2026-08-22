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
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CustomizeEntityType } from '../../../constants/Customize.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Page, PageType } from '../../../generated/system/ui/page';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { useGenericContext } from './GenericContext';
import { GenericProvider } from './GenericProvider';

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({ entityRules: {} })),
}));

jest.mock('../../../hooks/useChangeSummary', () => ({
  useChangeSummary: jest.fn().mockImplementation(() => ({ changeSummary: {} })),
}));

jest.mock(
  '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: () => ({
      postFeed: jest.fn(),
      deleteFeed: jest.fn(),
      updateFeed: jest.fn(),
    }),
  })
);

jest.mock('../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div>ActivityThreadPanel</div>),
}));

const DOCUMENTATION_WIDGETS = [
  { i: 'KnowledgePanel.LeftPanel', h: 8, w: 6, x: 0, y: 0 },
  { i: 'KnowledgePanel.Owners', h: 1, w: 2, x: 6, y: 0 },
];

// A persona customization that reorders the Domain page so Documentation is no longer
// the first tab -- the configuration reported in issue #29940.
const REORDERED_DOMAIN_PAGE = {
  pageType: PageType.Domain,
  tabs: [
    { id: EntityTabs.SUBDOMAINS, layout: [] },
    { id: EntityTabs.ASSETS, layout: [] },
    { id: EntityTabs.DOCUMENTATION, layout: DOCUMENTATION_WIDGETS },
  ],
} as unknown as Page;

const LayoutProbe = () => {
  const { layout } = useGenericContext();

  return (
    <div data-testid="layout-keys">
      {(layout ?? []).map((widget) => widget.i).join(',')}
    </div>
  );
};

const renderAt = (
  path: string,
  routePath: string,
  props: Record<string, unknown> = {}
) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <GenericProvider
              customizedPage={REORDERED_DOMAIN_PAGE}
              data={{ id: '123', name: 'domain' }}
              permissions={DEFAULT_ENTITY_PERMISSION}
              type={EntityType.DOMAIN as CustomizeEntityType}
              onUpdate={jest.fn()}
              {...props}>
              <LayoutProbe />
            </GenericProvider>
          }
          path={routePath}
        />
      </Routes>
    </MemoryRouter>
  );

describe('GenericProvider layout resolution', () => {
  it('resolves the layout from the URL tab when one is present', () => {
    renderAt('/domain/finance/documentation', '/domain/:fqn/:tab');

    expect(screen.getByTestId('layout-keys')).toHaveTextContent(
      DOCUMENTATION_WIDGETS.map((widget) => widget.i).join(',')
    );
  });

  it('resolves the layout from the activeTab prop when the URL has no tab', () => {
    renderAt('/domain/finance', '/domain/:fqn', {
      activeTab: EntityTabs.DOCUMENTATION,
    });

    expect(screen.getByTestId('layout-keys')).toHaveTextContent(
      DOCUMENTATION_WIDGETS.map((widget) => widget.i).join(',')
    );
  });

  it('prefers the activeTab prop over the URL tab so an inline tab switch wins', () => {
    // The domain tree view keeps the tab in local state and never writes it to the URL.
    renderAt('/domain/finance/documentation', '/domain/:fqn/:tab', {
      activeTab: EntityTabs.SUBDOMAINS,
    });

    expect(screen.getByTestId('layout-keys')).toHaveTextContent('');
  });

  it('falls back to the first customized tab when neither is supplied', () => {
    renderAt('/domain/finance', '/domain/:fqn');

    expect(screen.getByTestId('layout-keys')).toHaveTextContent('');
  });
});
