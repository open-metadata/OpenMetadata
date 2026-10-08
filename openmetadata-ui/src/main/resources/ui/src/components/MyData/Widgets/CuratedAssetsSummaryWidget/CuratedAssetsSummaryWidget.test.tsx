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
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { CuratedAssetsSource } from '../../../../hooks/useCuratedAssets';
import { WidgetConfig } from '../../../../interface/customization.interface';
import CuratedAssetsSummaryWidget from './CuratedAssetsSummaryWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echoes interpolation, so a test can see what was passed and not only
    // which key.
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

const mockGetExploreURLForAdvancedFilter = jest.fn(
  (_args: unknown) => '/explore?saved'
);
jest.mock('../../../../utils/CuratedAssetsPureUtils', () => ({
  getExploreURLForAdvancedFilter: (args: unknown) =>
    mockGetExploreURLForAdvancedFilter(args),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getExplorePath: ({
    extraParameters,
  }: {
    extraParameters?: Record<string, string>;
  }) => `/explore?quickFilter=${extraParameters?.quickFilter ?? ''}`,
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
    useAdvanceSearch: () => ({ config: { fields: {} } }),
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
      refetch: jest.fn(),
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

  // The summary used to be built as `${label} is ${value}` joined with ', ' —
  // English word order and punctuation hardcoded into every locale.
  it('describes the chip rule through one interpolated key per clause', () => {
    renderWidget(layoutWith(undefined));

    // The summary is the one node naming both clauses; the rule chips below
    // carry one each.
    const summary = screen
      .getAllByText(/message\.field-is-value/)
      .find(
        (node) =>
          node.textContent?.includes('label.tier') &&
          node.textContent?.includes('label.certification')
      );

    expect(summary).toBeDefined();
    expect(summary?.textContent).not.toMatch(/ is /);
  });

  // "View all matches" used to open Explore with no filter at all.
  it('opens Explore on the chip rule it counts', () => {
    renderWidget(layoutWith(undefined));

    fireEvent.click(screen.getByTestId('topic-action-curatedAssets'));

    const url = String(mockNavigate.mock.calls[0][0]);

    expect(url).toContain('tier.tagFQN');
    expect(url).toContain('Tier.Tier1');
    expect(url).toContain('Certification.Gold');
  });

  it('opens Explore on a saved filter through the advanced-search tree', () => {
    renderWidget(
      layoutWith({ queryFilter: SAVED_FILTER, resources: ['table'] })
    );

    fireEvent.click(screen.getByTestId('topic-action-curatedAssets'));

    expect(mockGetExploreURLForAdvancedFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        queryFilter: SAVED_FILTER,
        selectedResource: ['table'],
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/explore?saved');
  });

  it('shows an error body instead of an empty rule result on failure', () => {
    mockUseCuratedAssets.mockReturnValue({
      assets: [],
      isError: true,
      isLoading: false,
      refetch: jest.fn(),
      totalCount: 0,
    });

    renderWidget(layoutWith(undefined));

    expect(screen.getByTestId('topic-error-curatedAssets')).toBeInTheDocument();
    expect(screen.queryByTestId('topic-status-curatedAssets')).toBeNull();
  });
});
