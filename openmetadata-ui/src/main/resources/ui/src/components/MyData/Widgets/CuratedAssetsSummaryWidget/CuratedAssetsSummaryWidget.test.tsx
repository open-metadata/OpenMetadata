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
import { CuratedAssetsSource } from '../../../../hooks/useCuratedAssets';
import { WidgetConfig } from '../../../../interface/customization.interface';
import CuratedAssetsSummaryWidget from './CuratedAssetsSummaryWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

const mockUseCuratedAssets = jest.fn();
jest.mock('../../../../hooks/useCuratedAssets', () => ({
  useCuratedAssets: (source: CuratedAssetsSource) =>
    mockUseCuratedAssets(source),
}));

jest.mock(
  '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    AdvanceSearchProvider: ({ children }: { children?: ReactNode }) => (
      <>{children}</>
    ),
  })
);

jest.mock(
  '../CuratedAssetsWidget/CuratedAssetsModal/CuratedAssetsModal',
  () => ({
    __esModule: true,
    default: () => <div data-testid="curated-assets-modal" />,
  })
);

const WIDGET_KEY = 'KnowledgePanel.CuratedAssets';
const SAVED_FILTER = '{"query":{"bool":{"must":[]}}}';

const layoutWith = (config?: WidgetConfig['config']): WidgetConfig[] => [
  { config, h: 3, i: WIDGET_KEY, static: false, w: 1, x: 0, y: 0 },
];

const renderWidget = (
  currentLayout: WidgetConfig[],
  isEditView = false,
  widgetKey = WIDGET_KEY
) =>
  render(
    <CuratedAssetsSummaryWidget
      currentLayout={currentLayout}
      isEditView={isEditView}
      widgetKey={widgetKey}
    />
  );

describe('CuratedAssetsSummaryWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCuratedAssets.mockReturnValue({
      assets: [],
      isError: false,
      isLoading: false,
      totalCount: 0,
    });
  });

  // The regression this pins: `getWidgetFromKey` hands the widget
  // `currentLayout` and `widgetKey` but not its own layout entry, so a widget
  // that read a `widgetConfig` prop saw an undefined config forever — a saved
  // rule could never be shown, and the editor never left its empty state.
  it('reads its saved config from the layout entry, not a widgetConfig prop', () => {
    renderWidget(
      layoutWith({ queryFilter: SAVED_FILTER, title: 'Certified Tables' })
    );

    expect(mockUseCuratedAssets).toHaveBeenCalledWith(
      expect.objectContaining({ queryFilter: SAVED_FILTER })
    );
    expect(screen.getByText('Certified Tables')).toBeInTheDocument();
  });

  it('matches its layout entry by the suffixed key a picker-added widget has', () => {
    const instanceKey = `${WIDGET_KEY}-211`;
    const layout: WidgetConfig[] = [
      {
        config: { queryFilter: SAVED_FILTER, title: 'Second Instance' },
        h: 3,
        i: instanceKey,
        static: false,
        w: 1,
        x: 0,
        y: 0,
      },
    ];

    renderWidget(layout, false, instanceKey);

    expect(mockUseCuratedAssets).toHaveBeenCalledWith(
      expect.objectContaining({ queryFilter: SAVED_FILTER })
    );
  });

  it('prompts the persona editor to define a rule when none is saved', () => {
    renderWidget(layoutWith(undefined), true);

    expect(screen.getByTestId('widget-empty-state')).toBeInTheDocument();
  });

  // A reader cannot act on "Create", so the prompt is editor-only. The card
  // still renders, falling back to the built-in rule.
  it('never shows the create prompt outside the editor', () => {
    renderWidget(layoutWith(undefined));

    expect(screen.queryByTestId('widget-empty-state')).not.toBeInTheDocument();
    expect(screen.getByText('label.rule')).toBeInTheDocument();
  });

  it('offers an edit affordance once a rule is saved', () => {
    renderWidget(layoutWith({ queryFilter: SAVED_FILTER }), true);

    expect(screen.getByTestId('edit-curated-assets')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-empty-state')).not.toBeInTheDocument();
  });
});
