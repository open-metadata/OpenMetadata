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
import { getLandingPageHeaderTintStyle } from './landingPageHeaderColor';

// The default variant's class carries the gradient; a tinted header drops it
// so the inline wash is the only background.
const DEFAULT_GRADIENT_CLASS = 'tw:bg-[linear-gradient';

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

// jsdom drops any `linear-gradient` it is handed, so the inline style cannot
// be read back off the element. Spy on the helper instead: what it is asked to
// tint with is what the page resolved, and its own suite covers the CSS.
jest.mock('./landingPageHeaderColor', () => {
  const actual = jest.requireActual('./landingPageHeaderColor');

  return {
    ...actual,
    getLandingPageHeaderTintStyle: jest.fn(
      actual.getLandingPageHeaderTintStyle
    ),
  };
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
    jest.clearAllMocks();
  });

  it('should render the fixed shell sections above the widget grid', async () => {
    renderHome();

    expect(await screen.findByTestId('react-grid-layout')).toBeInTheDocument();
    expect(screen.getByTestId('announcements-rail')).toBeInTheDocument();
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

  it('should keep the default gradient header when no colour is saved', async () => {
    renderHome();

    const header = await screen.findByTestId('page-header');

    expect(header.className).toContain(DEFAULT_GRADIENT_CLASS);
    expect(getLandingPageHeaderTintStyle).toHaveBeenLastCalledWith(undefined);
  });

  it("should tint the header with the persona's saved header colour", async () => {
    mockSelectedPersona = {
      fullyQualifiedName: mockPersonaName,
      id: 'persona-id',
    };
    (getDocumentByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...mockDocumentData,
        data: {
          ...mockDocumentData.data,
          personPreferences: [
            {
              personaId: 'persona-id',
              personaName: mockPersonaName,
              landingPageSettings: { headerColor: '#099250' },
            },
          ],
        },
      })
    );

    renderHome();

    await screen.findByTestId(LandingPageWidgetKeys.ACTIVITY_FEED);

    expect(getLandingPageHeaderTintStyle).toHaveBeenLastCalledWith('#099250');
    expect(screen.getByTestId('page-header').className).not.toContain(
      DEFAULT_GRADIENT_CLASS
    );
  });

  it("should prefer the user's own header colour over the persona's", async () => {
    mockSelectedPersona = {
      fullyQualifiedName: mockPersonaName,
      id: 'persona-id',
    };
    mockCurrentUser = {
      ...mockUserData,
      personaPreferences: [
        {
          personaId: 'persona-id',
          personaName: mockPersonaName,
          landingPageSettings: { headerColor: '#DD2590' },
        },
      ],
    };

    renderHome();

    await screen.findByTestId(LandingPageWidgetKeys.ACTIVITY_FEED);

    expect(getLandingPageHeaderTintStyle).toHaveBeenLastCalledWith('#DD2590');
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
