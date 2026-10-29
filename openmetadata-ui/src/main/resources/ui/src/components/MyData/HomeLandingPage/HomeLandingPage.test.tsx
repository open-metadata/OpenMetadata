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
import type { User } from '../../../generated/entity/teams/user';
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

let mockHasLiveCritical = false;

// Stands in for the banner's own query: either a live critical banner, or
// whatever the page handed it to show in its place.
jest.mock('./CriticalAnnouncements', () => ({
  __esModule: true,
  default: ({ fallback }: { fallback?: React.ReactNode }) =>
    mockHasLiveCritical ? (
      <div data-testid="critical-announcements" />
    ) : (
      <>{fallback}</>
    ),
}));

jest.mock('./HomeLandingPageHeader', () => ({
  __esModule: true,
  default: () => <div data-testid="home-greeting" />,
}));

let mockIsAiMode = false;

jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => mockIsAiMode,
}));

jest.mock('./AnnouncementsRail', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="announcements-rail" />);
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
let mockCurrentUser: User | undefined = mockUserData;

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: mockCurrentUser,
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
    mockCurrentUser = mockUserData;
    mockHasLiveCritical = false;
    mockIsAiMode = false;
    jest.clearAllMocks();
  });

  it('should render the fixed shell sections above the widget grid', async () => {
    renderHome();

    expect(await screen.findByTestId('react-grid-layout')).toBeInTheDocument();
    expect(screen.getByTestId('announcements-rail')).toBeInTheDocument();
  });

  it('renders no Needs you now section when the deployment supplies none', async () => {
    renderHome();

    await screen.findByTestId('react-grid-layout');

    expect(screen.queryByTestId('needs-you-now-slot')).not.toBeInTheDocument();
  });

  it('renders the deployment-supplied Needs you now section', async () => {
    const NeedsYouNowSection = () => <div data-testid="needs-you-now-slot" />;
    mockCustomizePageClassBase.getNeedsYouNowSection = () => NeedsYouNowSection;

    renderHome();

    expect(await screen.findByTestId('needs-you-now-slot')).toBeInTheDocument();

    mockCustomizePageClassBase.getNeedsYouNowSection = () => null;
  });

  it('always offers the Customize entry point', async () => {
    renderHome();

    expect(
      await screen.findByTestId('customize-home-page')
    ).toBeInTheDocument();
  });

  it('greets the user above the announcements', async () => {
    renderHome();

    expect(await screen.findByTestId('home-greeting')).toBeInTheDocument();
    expect(
      screen.queryByTestId('critical-announcements')
    ).not.toBeInTheDocument();
  });

  it('gives the greeting slot to a live critical announcement', async () => {
    mockHasLiveCritical = true;
    renderHome();

    expect(
      await screen.findByTestId('critical-announcements')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('home-greeting')).not.toBeInTheDocument();
  });

  // AI mode's "Needs you now" heading greets the user instead.
  it('opens on no greeting in AI mode', async () => {
    mockIsAiMode = true;
    renderHome();

    await screen.findByTestId('react-grid-layout');

    expect(screen.queryByTestId('home-greeting')).not.toBeInTheDocument();
  });

  it('still gives the top slot to a live critical announcement in AI mode', async () => {
    mockIsAiMode = true;
    mockHasLiveCritical = true;
    renderHome();

    expect(
      await screen.findByTestId('critical-announcements')
    ).toBeInTheDocument();
  });

  it('offers no Customize entry point without a persona to edit', async () => {
    mockSelectedPersona = null;
    renderHome();

    await screen.findByTestId('react-grid-layout');

    expect(screen.queryByTestId('customize-home-page')).not.toBeInTheDocument();
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

  // The store sets the persona in the same write as the user, so before the
  // user arrives "no persona" is not yet an answer. Rendering the default grid
  // then would fire its widget queries only to unmount them a moment later.
  it('should hold the skeleton, not the default grid, until the user has loaded', () => {
    mockCurrentUser = undefined;
    mockSelectedPersona = null;

    renderHome();

    expect(screen.getByText('HomeLandingPageSkeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('react-grid-layout')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(LandingPageWidgetKeys.ACTIVITY_FEED)
    ).not.toBeInTheDocument();
  });

  it("should go straight from the skeleton to the persona's grid once the user loads", async () => {
    mockCurrentUser = undefined;
    mockSelectedPersona = null;

    const { rerender } = renderHome();

    expect(screen.getByText('HomeLandingPageSkeleton')).toBeInTheDocument();

    mockCurrentUser = mockUserData;
    mockSelectedPersona = { fullyQualifiedName: mockPersonaName };
    rerender(
      <QueryClientProvider client={queryClient}>
        <HomeLandingPage />
      </QueryClientProvider>
    );

    expect(
      await screen.findByTestId(LandingPageWidgetKeys.ACTIVITY_FEED)
    ).toBeInTheDocument();
    expect(getDocumentByFQN).toHaveBeenCalledTimes(1);
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
