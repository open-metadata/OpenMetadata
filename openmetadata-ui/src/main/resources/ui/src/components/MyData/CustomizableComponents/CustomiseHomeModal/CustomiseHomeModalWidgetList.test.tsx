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
import { act, render, screen } from '@testing-library/react';
import { ModalProps } from 'antd';
import { CustomiseHomeModalSelectedKey } from '../../../../enums/CustomizablePage.enum';
import { Document } from '../../../../generated/entity/docStore/document';
import { getAllKnowledgePanels } from '../../../../rest/DocStoreAPI';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { MY_DATA_WIDGET_KEYS } from '../../../../utils/CustomizeMyDataPageWidgetUtils';
import CustomiseHomeModal from './CustomiseHomeModal';

jest.mock('../../../../rest/DocStoreAPI', () => ({
  getAllKnowledgePanels: jest.fn(),
}));

jest.mock('../../HeaderTheme/HeaderTheme', () => () => null);

// Surfaces exactly what the picker decided to offer.
jest.mock('../AllWidgetsContent/AllWidgetsContent', () => ({
  __esModule: true,
  default: ({ widgets }: { widgets: Document[] }) => (
    <ul data-testid="offered">
      {widgets.map((widget) => (
        <li key={widget.fullyQualifiedName}>{widget.fullyQualifiedName}</li>
      ))}
    </ul>
  ),
}));

jest.mock('antd', () => {
  const antd = jest.requireActual('antd');

  return {
    ...antd,
    Modal: ({ children, open }: ModalProps) =>
      open ? <div>{children}</div> : null,
  };
});

const asDoc = (fullyQualifiedName: string, index: number) =>
  ({
    id: String(index),
    name: fullyQualifiedName,
    fullyQualifiedName,
  } as Document);

/**
 * Everything docStore can hold: the widgets this build renders, plus the
 * retired, other-edition and never-rendered panels that accumulate there
 * because seeds are inserted once and never withdrawn.
 */
const SEEDED_PANELS = [
  ...MY_DATA_WIDGET_KEYS,
  'KnowledgePanel.RecentlyViewed',
  'KnowledgePanel.PipelineStatus',
  'KnowledgePanel.Announcements',
  'KnowledgePanel.MyData',
  'KnowledgePanel.Following',
  'KnowledgePanel.TotalAssets',
  'KnowledgePanel.AskCollateActionRequired',
  'KnowledgePanel.SomethingSeededLater',
].map(asDoc);

const renderPicker = async () => {
  (getAllKnowledgePanels as jest.Mock).mockResolvedValue({
    data: SEEDED_PANELS,
  });

  await act(async () => {
    render(
      <CustomiseHomeModal
        open
        defaultSelectedKey={CustomiseHomeModalSelectedKey.ALL_WIDGETS}
        onClose={jest.fn()}
      />
    );
  });

  return screen.getAllByRole('listitem').map((item) => item.textContent ?? '');
};

describe('CustomiseHomeModal widget list', () => {
  it('offers exactly the widgets the page can render', async () => {
    const offered = await renderPicker();

    expect(offered).toEqual([...MY_DATA_WIDGET_KEYS]);
  });

  it('withholds a panel seeded after this build, rather than offering a blank cell', async () => {
    const offered = await renderPicker();

    // The previous denylist named the bad FQNs one by one, so anything seeded
    // later was offered by default and rendered as an empty grid slot.
    expect(offered).not.toContain('KnowledgePanel.SomethingSeededLater');
    expect(offered).not.toContain('KnowledgePanel.RecentlyViewed');
  });

  describe('when a subclass registers its own widget', () => {
    const EXTENSION_KEY = 'KnowledgePanel.SomethingSeededLater';

    afterEach(() => jest.restoreAllMocks());

    // The picker reads the overridable registry, not the OSS map, so a widget
    // a subclass resolves in `getWidgetsFromKey` can be offered too.
    it('offers it once it is in the registry', async () => {
      jest
        .spyOn(customizeMyDataPageClassBase, 'getKnownWidgetKeyPrefixes')
        .mockReturnValue([...MY_DATA_WIDGET_KEYS, EXTENSION_KEY]);

      expect(await renderPicker()).toContain(EXTENSION_KEY);
    });

    // A widget the platform places itself (Collate's onboarding checklist)
    // must survive a saved layout without becoming something users can add.
    it('withholds it when the subclass keeps it out of the pickable set', async () => {
      jest
        .spyOn(customizeMyDataPageClassBase, 'getKnownWidgetKeyPrefixes')
        .mockReturnValue([...MY_DATA_WIDGET_KEYS, EXTENSION_KEY]);
      jest
        .spyOn(customizeMyDataPageClassBase, 'getPickableWidgetKeyPrefixes')
        .mockReturnValue([...MY_DATA_WIDGET_KEYS]);

      expect(await renderPicker()).toEqual([...MY_DATA_WIDGET_KEYS]);
    });
  });
});

describe('CustomiseHomeModal sidebar', () => {
  const sidebarLabels = () =>
    screen
      .getAllByTestId(/^sidebar-option-KnowledgePanel\./)
      .map((option) => option.textContent ?? '');

  it('lists the renderable widgets and none of the retired ones', async () => {
    await renderPicker();

    expect(sidebarLabels()).toHaveLength(MY_DATA_WIDGET_KEYS.length);
    expect(sidebarLabels().join('|')).not.toMatch(
      /My Data|Following|Total Assets|My Task|Recently Viewed/
    );
  });

  it('labels a widget by its displayName, not the key it kept', async () => {
    (getAllKnowledgePanels as jest.Mock).mockResolvedValue({
      data: [
        {
          id: '1',
          name: 'ActivityFeed',
          displayName: 'Team Activity',
          fullyQualifiedName: 'KnowledgePanel.ActivityFeed',
        },
        {
          id: '2',
          name: 'KPI',
          displayName: 'KPIs',
          fullyQualifiedName: 'KnowledgePanel.KPI',
        },
      ] as Document[],
    });

    await act(async () => {
      render(
        <CustomiseHomeModal
          open
          defaultSelectedKey={CustomiseHomeModalSelectedKey.ALL_WIDGETS}
          onClose={jest.fn()}
        />
      );
    });

    // `KnowledgePanel.ActivityFeed` renders the Team Activity card now, so the
    // key-derived name would advertise the widget it replaced...
    expect(sidebarLabels()).toContain('Team Activity');
    expect(sidebarLabels()).not.toContain('Activity Feed');
    // ...and a displayName must not be re-cased on the way out.
    expect(sidebarLabels()).toContain('KPIs');
    expect(sidebarLabels()).not.toContain('KP Is');
  });
});
