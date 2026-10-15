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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ROUTES } from '../../../../constants/constants';
import { useTotalDataAssets } from '../../../../hooks/useTotalDataAssets';
import { FilterButtonOption } from '../Common/TopicWidget/FilterButton';
import TotalDataAssetsWidget from './TotalDataAssetsWidget';

// The charts entry is a separate bundle that jest maps to the built dist; the
// sibling TopicWidget tests stub it the same way.
jest.mock('@openmetadata/ui-core-components/charts', () => ({
  BarChart: () => <div data-testid="bar-chart" />,
  getSeriesColor: (index: number) => `color-${index}`,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echoes the options, so a test can tell which figures a label carries.
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Spread the real module: the widget also reads its exported window constants,
// and a bare factory would blank them out.
jest.mock('../../../../hooks/useTotalDataAssets', () => ({
  ...jest.requireActual('../../../../hooks/useTotalDataAssets'),
  useTotalDataAssets: jest.fn(),
}));

// The real control is a popover listbox; here each option is a button so a
// test can pick one without driving react-aria's pointer dance.
jest.mock('../Common/TopicWidget/FilterButton', () => ({
  __esModule: true,
  default: ({
    options,
    value,
    onChange,
    testId,
  }: {
    options: FilterButtonOption[];
    value: string;
    onChange: (next: string) => void;
    testId?: string;
  }) => (
    <div data-selected={value} data-testid={testId}>
      {options.map((option) => (
        <button
          data-testid={`${testId}-${option.value}`}
          key={option.value}
          onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

const TABLE = {
  count: 800,
  delta: 24,
  key: 'table',
  name: 'Table',
  share: 80,
};
const DASHBOARD = {
  count: 150,
  delta: 31,
  key: 'dashboard',
  name: 'Dashboard',
  share: 15,
};
const CONTAINER = {
  count: 50,
  delta: -3,
  key: 'container',
  name: 'Container',
  share: 5,
};

const TOTALS = {
  assetTypes: [TABLE, DASHBOARD, CONTAINER],
  fastestGrowing: DASHBOARD,
  isError: false,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
  totalAssets: 1000,
  totalDelta: 52,
  windowDays: 7,
};

const renderWidget = (totals: Partial<typeof TOTALS> = {}) => {
  (useTotalDataAssets as jest.Mock).mockReturnValue({ ...TOTALS, ...totals });

  return render(
    <TotalDataAssetsWidget widgetKey="KnowledgePanel.TotalAssets-1" />
  );
};

describe('TotalDataAssetsWidget', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the total and one row per asset type, largest first', () => {
    renderWidget();

    expect(screen.getByTestId('total-data-assets-total')).toHaveTextContent(
      '1,000'
    );

    const rows = within(screen.getByTestId('asset-type-rows')).getAllByRole(
      'listitem'
    );

    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'asset-type-row-table',
      'asset-type-row-dashboard',
      'asset-type-row-container',
    ]);
    expect(within(rows[0]).getByTestId('asset-type-count')).toHaveTextContent(
      '800'
    );
  });

  it('signs each type’s change, so a shrinking type reads as one', () => {
    renderWidget();

    expect(
      within(screen.getByTestId('asset-type-row-dashboard')).getByTestId(
        'asset-type-delta'
      )
    ).toHaveTextContent('+31');
    expect(
      within(screen.getByTestId('asset-type-row-container')).getByTestId(
        'asset-type-delta'
      )
    ).toHaveTextContent('-3');
  });

  // A window with no baseline day has no movement to report per type.
  it('leaves the delta slot empty when there is no baseline', () => {
    renderWidget({
      assetTypes: [{ ...TABLE, delta: null } as never],
      fastestGrowing: undefined,
      totalDelta: null,
    } as never);

    expect(screen.queryByTestId('asset-type-delta')).toBeNull();
    expect(screen.queryByTestId('topic-status-totalDataAssets')).toBeNull();
  });

  it('names the fastest-growing type in the summary', () => {
    renderWidget();

    expect(
      screen.getByText(/message\.entity-grew-fastest {"entity":"Dashboard"}/)
    ).toBeInTheDocument();
  });

  it('words the status chip for the window the delta was measured over', () => {
    renderWidget({ windowDays: 30 });

    expect(
      screen.getByTestId('topic-status-totalDataAssets')
    ).toHaveTextContent(
      'message.value-in-last-count-days {"count":30,"value":"+52"}'
    );
  });

  it('asks the hook for the selected window', () => {
    renderWidget();

    fireEvent.click(screen.getByTestId('total-data-assets-window-filter-14'));

    expect(useTotalDataAssets).toHaveBeenLastCalledWith({ windowDays: 14 });
  });

  it('opens Explore from the footer', () => {
    renderWidget();

    fireEvent.click(screen.getByTestId('topic-action-totalDataAssets'));

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.EXPLORE);
  });

  it('shows the empty state, not a zero total, before anything is counted', () => {
    renderWidget({ assetTypes: [], totalAssets: 0, totalDelta: null } as never);

    expect(
      screen.getByTestId('topic-empty-totalDataAssets')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('total-data-assets-total')).toBeNull();
  });

  it('shows an error body, not an empty estate, when the fetch fails', () => {
    renderWidget({ assetTypes: [], isError: true, totalAssets: 0 } as never);

    expect(
      screen.getByTestId('topic-error-totalDataAssets')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('topic-empty-totalDataAssets')).toBeNull();
  });
});
