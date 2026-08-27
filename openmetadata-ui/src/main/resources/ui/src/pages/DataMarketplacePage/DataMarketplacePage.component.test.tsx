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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { PageType } from '../../generated/system/ui/page';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import DataMarketplacePage from './DataMarketplacePage.component';

const mockPersonaName = 'testPersona';

let mockSelectedPersona: Record<string, string> | null = {
  fullyQualifiedName: mockPersonaName,
};

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    selectedPersona: mockSelectedPersona,
  })),
}));

jest.mock('../../components/common/DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation(() => <div>DocumentTitle</div>)
);

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});

jest.mock(
  '../../components/DataMarketplace/AnnouncementsWidgetV2/AnnouncementsWidgetV2.component',
  () => jest.fn().mockImplementation(() => <div>AnnouncementsWidgetV2</div>)
);

jest.mock(
  '../../components/DataMarketplace/MarketplaceGreetingBanner/MarketplaceGreetingBanner.component',
  () => jest.fn().mockImplementation(() => <div>MarketplaceGreetingBanner</div>)
);

jest.mock(
  '../../components/DataMarketplace/MarketplaceSearchBar/MarketplaceSearchBar.component',
  () => jest.fn().mockImplementation(() => <div>MarketplaceSearchBar</div>)
);

jest.mock('../../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../components/common/DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation(() => null)
);

jest.mock('../../utils/DataMarketplace/DataMarketplaceClassBase', () => ({
  __esModule: true,
  default: {
    getDefaultLayout: jest.fn().mockReturnValue([
      {
        h: 1,
        i: 'marketplace-data-products',
        w: 8,
        x: 0,
        y: 0,
        static: false,
      },
    ]),
    getWidgetsFromKey: jest
      .fn()
      .mockImplementation((widgetConfig: { i: string }) => (
        <div data-testid={widgetConfig.i}>{widgetConfig.i}</div>
      )),
  },
}));

const defaultLayoutWidgetId = 'marketplace-data-products';

let queryClient: QueryClient;

const renderDataMarketplacePage = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <DataMarketplacePage />
    </QueryClientProvider>
  );

describe('DataMarketplacePage component', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockSelectedPersona = { fullyQualifiedName: mockPersonaName };
    jest.clearAllMocks();
  });

  it('renders the default layout when the persona has no saved customization (404)', async () => {
    (getDocumentByFQN as jest.Mock).mockRejectedValue({
      response: {
        status: 404,
        data: {
          message: `document instance for persona.${mockPersonaName} not found`,
        },
      },
    });

    renderDataMarketplacePage();

    expect(
      await screen.findByTestId(defaultLayoutWidgetId)
    ).toBeInTheDocument();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('renders the customized layout from the fetched document', async () => {
    (getDocumentByFQN as jest.Mock).mockResolvedValue({
      data: {
        pages: [
          {
            pageType: PageType.DataMarketplace,
            tabs: [
              {
                id: 'overview',
                layout: [
                  {
                    h: 1,
                    i: 'marketplace-domains',
                    w: 8,
                    x: 0,
                    y: 0,
                    static: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    renderDataMarketplacePage();

    expect(
      await screen.findByTestId('marketplace-domains')
    ).toBeInTheDocument();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('renders the default layout when a legacy persona document contains a null page', async () => {
    (getDocumentByFQN as jest.Mock).mockResolvedValue({
      data: {
        pages: [
          {
            pageType: PageType.LandingPage,
          },
          null,
        ],
      },
    });

    renderDataMarketplacePage();

    expect(
      await screen.findByTestId(defaultLayoutWidgetId)
    ).toBeInTheDocument();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('renders the default layout when no persona is selected', async () => {
    mockSelectedPersona = null;

    renderDataMarketplacePage();

    expect(
      await screen.findByTestId(defaultLayoutWidgetId)
    ).toBeInTheDocument();
    expect(getDocumentByFQN).not.toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('shows an error toast for a genuine failure (non-404) while still falling back to the default layout', async () => {
    (getDocumentByFQN as jest.Mock).mockRejectedValue({
      response: {
        status: 500,
        data: { message: 'Internal Server Error' },
      },
    });

    renderDataMarketplacePage();

    expect(
      await screen.findByTestId(defaultLayoutWidgetId)
    ).toBeInTheDocument();
    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });
});
