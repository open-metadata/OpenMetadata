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
import { render, screen, waitFor } from '@testing-library/react';
import { LandingPageWidgetKeys } from '../../../enums/CustomizablePage.enum';
import {
  mockCustomizePageClassBase,
  mockDocumentData,
  mockPersonaName,
  mockUserData,
} from '../../../mocks/MyDataPage.mock';
import { getDocumentByFQN } from '../../../rest/DocStoreAPI';
import HomeLandingPage from './HomeLandingPage';

jest.mock('../../../utils/CustomizeMyDataPageClassBase', () => {
  return mockCustomizePageClassBase;
});

jest.mock('../../../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockDocumentData)),
}));

jest.mock('./HomeLandingPageSkeleton', () => {
  return jest.fn().mockImplementation(() => <div>HomeLandingPageSkeleton</div>);
});

jest.mock('./AnnouncementsRail', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="announcements-rail" />);
});

jest.mock('./NeedsYouNow/NeedsYouNowSection', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="needs-you-now" />);
});

jest.mock('./SystemAlertBanner', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="system-alert-banner" />);
});

jest.mock('../../common/DeferredWidget/DeferredWidget.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children }) => <>{children}</>),
}));

// Prefixed rather than bare: the grid cell itself now carries the layout key as
// its testid -- the handle the Playwright suites reach for -- so a bare one here
// would resolve to two elements.
jest.mock('../LandingPageWidgetRenderer/LandingPageWidgetRenderer', () => {
  return jest
    .fn()
    .mockImplementation(({ widgetConfig }) => (
      <div data-testid={`rendered-${widgetConfig.i}`}>{widgetConfig.i}</div>
    ));
});

jest.mock('../../../hooks/useGridLayoutDirection', () => ({
  useGridLayoutDirection: jest.fn().mockImplementation(() => 'ltr'),
}));

let mockSelectedPersona: Record<string, string> | null = {
  fullyQualifiedName: mockPersonaName,
};

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: mockUserData,
    selectedPersona: mockSelectedPersona,
  })),
}));

jest.mock('react-grid-layout', () => ({
  ...jest.requireActual('react-grid-layout'),
  WidthProvider: jest
    .fn()
    .mockImplementation(() =>
      jest
        .fn()
        .mockImplementation(({ children }) => (
          <div data-testid="react-grid-layout">{children}</div>
        ))
    ),
  __esModule: true,
  default: '',
}));

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(() => <div>Link</div>),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

let queryClient: QueryClient;

const renderHome = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <HomeLandingPage />
    </QueryClientProvider>
  );

describe('HomeLandingPage', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockSelectedPersona = { fullyQualifiedName: mockPersonaName };
    jest.clearAllMocks();
  });

  it('should render the fixed shell sections above the widget grid', async () => {
    renderHome();

    expect(await screen.findByTestId('react-grid-layout')).toBeInTheDocument();
    expect(screen.getByTestId('announcements-rail')).toBeInTheDocument();
  });

  // Both are built but deliberately not mounted: their stand-in content is an
  // invented security incident and an invented approval queue, and there is no
  // API behind either. Showing that to every user states something false about
  // their deployment.
  it('does not render the placeholder-backed alert banner or inbox', async () => {
    renderHome();
    await screen.findByTestId('react-grid-layout');

    expect(screen.queryByTestId('needs-you-now')).toBeNull();
    expect(screen.queryByTestId('system-alert-banner')).toBeNull();
  });

  // The banner used to gate it: the greeting and Customize only appeared once
  // the alert was dismissed, and dismissal was never persisted.
  it('always offers the Customize entry point', async () => {
    renderHome();

    expect(
      await screen.findByTestId('customize-home-page')
    ).toBeInTheDocument();
  });

  it('should show the skeleton while the persona layout is resolving', async () => {
    (getDocumentByFQN as jest.Mock).mockImplementationOnce(
      () => new Promise(() => undefined)
    );

    renderHome();

    expect(
      await screen.findByText('HomeLandingPageSkeleton')
    ).toBeInTheDocument();
  });

  it("should render the widgets from the persona's saved layout", async () => {
    renderHome();

    expect(
      await screen.findByTestId(LandingPageWidgetKeys.ACTIVITY_FEED)
    ).toBeInTheDocument();
  });

  it('should drop saved widgets that no longer resolve instead of leaving an empty cell', async () => {
    renderHome();

    await screen.findByTestId(LandingPageWidgetKeys.ACTIVITY_FEED);

    // Both are in mockCustomizedLayout but neither is in the registry any more.
    expect(
      screen.queryByTestId(LandingPageWidgetKeys.FOLLOWING)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(LandingPageWidgetKeys.RECENTLY_VIEWED)
    ).not.toBeInTheDocument();
  });

  it('should drop widgets the deployment excludes from the picker', async () => {
    mockCustomizePageClassBase.getExcludedWidgetFqns = () => [
      LandingPageWidgetKeys.ACTIVITY_FEED,
    ];

    renderHome();

    await waitFor(() =>
      expect(getDocumentByFQN).toHaveBeenCalledWith(
        `persona.${mockPersonaName}`
      )
    );

    expect(
      screen.queryByTestId(LandingPageWidgetKeys.ACTIVITY_FEED)
    ).not.toBeInTheDocument();

    mockCustomizePageClassBase.getExcludedWidgetFqns = () => [];
  });

  it('should fall back to the default layout when the persona document fails to load', async () => {
    (getDocumentByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('boom'))
    );

    renderHome();

    expect(
      await screen.findByTestId(LandingPageWidgetKeys.ACTIVITY_FEED)
    ).toBeInTheDocument();
  });

  it('should fall back to the default layout when no persona is selected', async () => {
    mockSelectedPersona = null;

    renderHome();

    expect(
      await screen.findByTestId(LandingPageWidgetKeys.ACTIVITY_FEED)
    ).toBeInTheDocument();
    expect(getDocumentByFQN).not.toHaveBeenCalled();
  });

  it('should render the footer slot only when one is supplied', async () => {
    const { rerender } = renderHome();

    await screen.findByTestId('react-grid-layout');

    expect(screen.queryByTestId('footer-slot')).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={queryClient}>
        <HomeLandingPage footerSlot={<div data-testid="footer-slot" />} />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('footer-slot')).toBeInTheDocument();
  });
});
