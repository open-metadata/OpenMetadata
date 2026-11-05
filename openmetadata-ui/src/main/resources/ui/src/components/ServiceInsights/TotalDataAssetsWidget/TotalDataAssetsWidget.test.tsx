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
import { ServiceInsightsWidgetType } from '../../../enums/ServiceInsights.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { ServicesType } from '../../../interface/service.interface';
import { getServiceInsightsWidgetPlaceholder } from '../../../utils/ServiceInsightsWidgets';
import { getReadableCountString } from '../../../utils/ServicePureUtils';
import { TotalAssetsCount } from '../ServiceInsightsTab.interface';
import TotalDataAssetsWidget from './TotalDataAssetsWidget';

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../../../utils/ServiceInsightsWidgets', () => ({
  getServiceInsightsWidgetPlaceholder: jest
    .fn()
    .mockImplementation(() => <div data-testid="widget-placeholder" />),
}));

jest.mock('../../../utils/ServicePureUtils', () => ({
  getReadableCountString: jest.fn().mockImplementation((value) => `${value}`),
}));

const mockUseApplicationStore = useApplicationStore as unknown as jest.Mock;
const mockGetPlaceholder =
  getServiceInsightsWidgetPlaceholder as unknown as jest.Mock;

const TABLES_COUNT_TESTID = 'Tables-count';
const PLACEHOLDER_TESTID = 'widget-placeholder';

const serviceDetails = { name: 'test-service' } as ServicesType;

const assets: TotalAssetsCount[] = [
  { name: 'Tables', value: 1200, icon: <span data-testid="tables-icon" /> },
  { name: 'Topics', value: 7, icon: <span data-testid="topics-icon" /> },
];

const renderWidget = (
  props: Partial<React.ComponentProps<typeof TotalDataAssetsWidget>> = {}
) =>
  render(
    <TotalDataAssetsWidget
      isLoading={false}
      serviceDetails={serviceDetails}
      totalAssetsCount={assets}
      {...props}
    />
  );

describe('TotalDataAssetsWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApplicationStore.mockReturnValue({
      theme: { primaryColor: '#111' },
    });
    mockGetPlaceholder.mockImplementation(() => (
      <div data-testid={PLACEHOLDER_TESTID} />
    ));
  });

  it('should render the header title above its description', () => {
    renderWidget();

    const title = screen.getByText('label.total-entity');
    const description = screen.getByText(
      'message.total-data-assets-description'
    );

    expect(title).toBeInTheDocument();
    expect(description).toBeInTheDocument();

    const descriptionFollowsTitle = Boolean(
      title.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING
    );

    expect(descriptionFollowsTitle).toBe(true);
  });

  it('should render one formatted count per asset, keyed by asset name', () => {
    renderWidget();

    expect(screen.getByTestId(TABLES_COUNT_TESTID)).toHaveTextContent('1200');
    expect(screen.getByTestId('Topics-count')).toHaveTextContent('7');
    expect(getReadableCountString).toHaveBeenCalledWith(1200);
    expect(getReadableCountString).toHaveBeenCalledWith(7);
    expect(screen.queryByTestId(PLACEHOLDER_TESTID)).not.toBeInTheDocument();
  });

  it('should show the placeholder when there are no assets', () => {
    renderWidget({ totalAssetsCount: [] });

    expect(screen.getByTestId(PLACEHOLDER_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(TABLES_COUNT_TESTID)).not.toBeInTheDocument();
  });

  it('should show the placeholder when every asset count is zero', () => {
    renderWidget({
      totalAssetsCount: assets.map((asset) => ({ ...asset, value: 0 })),
    });

    expect(screen.getByTestId(PLACEHOLDER_TESTID)).toBeInTheDocument();
  });

  it('should build the placeholder for this widget type against the active theme', () => {
    renderWidget({ totalAssetsCount: [] });

    expect(mockGetPlaceholder).toHaveBeenCalledWith(
      expect.objectContaining({
        chartType: ServiceInsightsWidgetType.TOTAL_DATA_ASSETS,
        theme: { primaryColor: '#111' },
      })
    );
  });

  it('should rebuild the placeholder when the theme changes', () => {
    // A fresh element per render: React bails out of re-rendering a referentially identical one,
    // which would make this pass regardless of the memo's dependencies.
    const emptyWidget = () => (
      <TotalDataAssetsWidget
        isLoading={false}
        serviceDetails={serviceDetails}
        totalAssetsCount={[]}
      />
    );
    const { rerender } = render(emptyWidget());

    mockUseApplicationStore.mockReturnValue({
      theme: { primaryColor: '#222' },
    });

    rerender(emptyWidget());

    // The memo must depend on `theme`; omitting it leaves the placeholder drawn in the colours of
    // whichever theme happened to be active on first render.
    expect(mockGetPlaceholder).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: { primaryColor: '#222' } })
    );
  });

  it('should not render asset counts while loading', () => {
    renderWidget({ isLoading: true });

    expect(screen.queryByTestId(TABLES_COUNT_TESTID)).not.toBeInTheDocument();
  });
});
