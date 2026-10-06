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
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { useDataEstate } from '../../../../hooks/useDataEstate';
import DataEstateWidget from './DataEstateWidget';

// The charts entry is a separate bundle that jest maps to the built dist; the
// sibling TopicWidget tests stub it the same way.
jest.mock('@openmetadata/ui-core-components/charts', () => ({
  AreaChart: () => <div data-testid="area-chart" />,
  BarChart: () => <div data-testid="bar-chart" />,
  getSeriesColor: (index: number) => `color-${index}`,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../../../hooks/useAppMode', () => ({
  useIsAiMode: jest.fn(),
}));

// Spread the real module: the widget also reads its exported window constants,
// and a bare factory would blank them out.
jest.mock('../../../../hooks/useDataEstate', () => ({
  ...jest.requireActual('../../../../hooks/useDataEstate'),
  useDataEstate: jest.fn(),
}));

const ESTATE = {
  totalAssets: 1257,
  totalDelta: 4,
  connectors: [{ count: 800, name: 'table' }],
  descriptionCoverage: 23,
  descriptionCoverageDelta: 0.4,
  descriptionCoverageSeries: [22.6, 23],
  isLoading: false,
  isError: false,
};

const renderWidget = (isAiMode: boolean, estate = ESTATE) => {
  (useIsAiMode as jest.Mock).mockReturnValue(isAiMode);
  (useDataEstate as jest.Mock).mockReturnValue(estate);

  return render(<DataEstateWidget widgetKey="KnowledgePanel.DataEstate-1" />);
};

describe('DataEstateWidget', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows description coverage in AI mode', () => {
    renderWidget(true);

    expect(screen.getByTestId('description-coverage')).toBeInTheDocument();
  });

  // The design pairs the figure with an agent's read on why it moved; without
  // that sentence Classic mode would show a bare percentage with no action.
  it('hides description coverage in classic mode', () => {
    renderWidget(false);

    expect(screen.queryByTestId('description-coverage')).toBeNull();
  });

  it('keeps the estate size and breakdown in both modes', () => {
    const { unmount } = renderWidget(true);

    expect(screen.getByTestId('data-estate-total')).toHaveTextContent('1,257');
    expect(screen.getByTestId('connector-breakdown')).toBeInTheDocument();

    unmount();
    renderWidget(false);

    expect(screen.getByTestId('data-estate-total')).toHaveTextContent('1,257');
    expect(screen.getByTestId('connector-breakdown')).toBeInTheDocument();
  });

  it('omits coverage in AI mode when the estate reports none', () => {
    renderWidget(true, { ...ESTATE, descriptionCoverage: null } as never);

    expect(screen.queryByTestId('description-coverage')).toBeNull();
  });
});
