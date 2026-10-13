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
import KnowledgePageVersionPage from './KnowledgePageVersionPage';

const mockNavigate = jest.fn();
const mockGetKnowledgePageByFqn = jest.fn();
const mockGetKnowledgePageVersionsList = jest.fn();
const mockGetKnowledgePageVersionData = jest.fn();
// `useParams` reads this binding at render time, so reassigning it before a
// `rerender` simulates a URL parameter change (e.g. a version navigation).
let mockParams: { fqn: string; version: string } = {
  fqn: 'articleFqn',
  version: '0.1',
};

jest.mock('../../rest/knowledgeCenterAPI', () => ({
  getKnowledgePageByFqn: jest.fn((...args: unknown[]) =>
    mockGetKnowledgePageByFqn(...args)
  ),
  getKnowledgePageVersionsList: jest.fn((...args: unknown[]) =>
    mockGetKnowledgePageVersionsList(...args)
  ),
  getKnowledgePageVersionData: jest.fn((...args: unknown[]) =>
    mockGetKnowledgePageVersionData(...args)
  ),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(() => mockParams),
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock(
  '../../components/KnowledgeCenter/KnowledgePageVersion/KnowledgePageVersion',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(
        (props: { knowledgePage: { displayName?: string; name?: string } }) => (
          <div data-testid="page-version-content">
            {props.knowledgePage?.displayName ?? props.knowledgePage?.name}
          </div>
        )
      ),
  })
);

jest.mock(
  '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => <div data-testid="EntityVersionTimeLine" />),
  })
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="box">{children}</div>
  ),
  Skeleton: () => <div data-testid="skeleton" />,
  SkeletonParagraph: () => <div data-testid="skeleton-paragraph" />,
}));

jest.mock('antd', () => ({
  Space: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="antd-space">{children}</div>
  ),
}));

jest.mock('../../utils/ContextCenterClassBase', () => ({
  __esModule: true,
  default: {
    getArticlePath: jest.fn((fqn: string) => `/article/${fqn}`),
    getArticleVersionPath: jest.fn(
      (fqn: string, v: string) => `/article/${fqn}/versions/${v}`
    ),
  },
}));

jest.mock('../../utils/KnowledgePagePureUtils', () => ({
  getKnowledgePageName: jest.fn(() => 'PageName'),
}));

const PAGE_V1_BASE = {
  id: 'kp-1',
  name: 'articleFqn',
  fullyQualifiedName: 'articleFqn',
  version: 0.1,
  displayName: 'Version 1 Title',
};

const PAGE_V1_DATA = {
  id: 'kp-1',
  name: 'articleFqn',
  fullyQualifiedName: 'articleFqn',
  version: 0.1,
  displayName: 'Version 1 Title',
};

const PAGE_V2_DATA = {
  id: 'kp-1',
  name: 'articleFqn',
  fullyQualifiedName: 'articleFqn',
  version: 0.2,
  displayName: 'Version 2 Title',
};

const PAGE_OTHER_BASE = {
  id: 'kp-2',
  name: 'otherFqn',
  fullyQualifiedName: 'otherFqn',
  version: 0.1,
  displayName: 'Other Title',
};

const VERSIONS_LIST = [
  { id: 'kp-1', version: 0.1 },
  { id: 'kp-1', version: 0.2 },
];

// Drains pending microtasks so awaited fetch mocks resolve within `act`.
// Uses microtasks (not `setTimeout`) because the project enables fake timers
// globally (`jest.config.js` -> `fakeTimers.enableGlobally`), so a
// `setTimeout`-based flush would never fire.
const flushPromises = async () => {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
};

describe('KnowledgePageVersionPage', () => {
  const mockOnPageChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // `mockReset` (not just `clearAllMocks`) clears each API mock's
    // implementation AND its `mockResolvedValueOnce` queue, so a once-only
    // override from one test cannot leak into the next.
    mockGetKnowledgePageByFqn.mockReset();
    mockGetKnowledgePageVersionsList.mockReset();
    mockGetKnowledgePageVersionData.mockReset();
    mockParams = { fqn: 'articleFqn', version: '0.1' };
    mockGetKnowledgePageByFqn.mockResolvedValue(PAGE_V1_BASE);
    mockGetKnowledgePageVersionsList.mockResolvedValue(VERSIONS_LIST);
    mockGetKnowledgePageVersionData.mockResolvedValue(PAGE_V1_DATA);
  });

  const renderPage = () =>
    render(<KnowledgePageVersionPage onPageChange={mockOnPageChange} />);

  it('fetches the base page, the version list, and the active version data once on mount', async () => {
    await act(async () => {
      renderPage();
      await flushPromises();
    });

    expect(mockGetKnowledgePageByFqn).toHaveBeenCalledTimes(1);
    expect(mockGetKnowledgePageByFqn).toHaveBeenCalledWith('articleFqn');
    expect(mockGetKnowledgePageVersionsList).toHaveBeenCalledTimes(1);
    expect(mockGetKnowledgePageVersionsList).toHaveBeenCalledWith('kp-1');
    expect(mockGetKnowledgePageVersionData).toHaveBeenCalledTimes(1);
    expect(mockGetKnowledgePageVersionData).toHaveBeenCalledWith('kp-1', '0.1');

    expect(screen.getByTestId('page-version-content').textContent).toBe(
      'Version 1 Title'
    );
    expect(screen.getByTestId('EntityVersionTimeLine')).toBeInTheDocument();
  });

  it('does NOT re-fetch the base page or version list when ONLY the version changes, and fetches the new version data', async () => {
    let rerender: (ui: React.ReactElement) => void;
    await act(async () => {
      const utils = renderPage();
      rerender = utils.rerender;
      await flushPromises();
    });

    const baseCount = mockGetKnowledgePageByFqn.mock.calls.length;
    const listCount = mockGetKnowledgePageVersionsList.mock.calls.length;

    mockGetKnowledgePageVersionData.mockResolvedValueOnce(PAGE_V2_DATA);
    mockParams = { fqn: 'articleFqn', version: '0.2' };

    await act(async () => {
      rerender(<KnowledgePageVersionPage onPageChange={mockOnPageChange} />);
      await flushPromises();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(mockGetKnowledgePageByFqn.mock.calls.length).toBe(baseCount);
    expect(mockGetKnowledgePageVersionsList.mock.calls.length).toBe(listCount);
    expect(mockGetKnowledgePageVersionData).toHaveBeenCalledWith('kp-1', '0.2');
    expect(screen.getByTestId('page-version-content').textContent).toBe(
      'Version 2 Title'
    );
  });

  it('keeps the page in the loading state (skeleton) during a version transition while the new version data is pending, without re-fetching the base page', async () => {
    let rerender: (ui: React.ReactElement) => void;
    await act(async () => {
      const utils = renderPage();
      rerender = utils.rerender;
      await flushPromises();
    });

    expect(screen.getByTestId('page-version-content').textContent).toBe(
      'Version 1 Title'
    );

    const deferredV2: { resolve: (value: unknown) => void } = {
      resolve: () => undefined,
    };
    mockGetKnowledgePageVersionData.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          deferredV2.resolve = resolve;
        })
    );
    mockParams = { fqn: 'articleFqn', version: '0.2' };

    await act(async () => {
      rerender(<KnowledgePageVersionPage onPageChange={mockOnPageChange} />);
      await flushPromises();
    });

    // The base entity must NOT be re-fetched on a version-only change.
    expect(mockGetKnowledgePageByFqn).toHaveBeenCalledTimes(1);
    // No committed render of the previous version content should remain while
    // the new version data is still loading; the skeleton branch is shown.
    expect(
      screen.queryByTestId('page-version-content')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();

    await act(async () => {
      deferredV2.resolve(PAGE_V2_DATA);
      await flushPromises();
    });

    expect(screen.getByTestId('page-version-content').textContent).toBe(
      'Version 2 Title'
    );
  });

  it('re-fetches the base page, version list, and version data when the FQN changes', async () => {
    let rerender: (ui: React.ReactElement) => void;
    await act(async () => {
      const utils = renderPage();
      rerender = utils.rerender;
      await flushPromises();
    });

    expect(mockGetKnowledgePageByFqn).toHaveBeenCalledTimes(1);

    mockGetKnowledgePageByFqn.mockResolvedValueOnce(PAGE_OTHER_BASE);
    mockGetKnowledgePageVersionsList.mockResolvedValueOnce(VERSIONS_LIST);
    mockGetKnowledgePageVersionData.mockResolvedValueOnce(PAGE_OTHER_BASE);
    mockParams = { fqn: 'otherFqn', version: '0.1' };

    await act(async () => {
      rerender(<KnowledgePageVersionPage onPageChange={mockOnPageChange} />);
      await flushPromises();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(mockGetKnowledgePageByFqn).toHaveBeenCalledTimes(2);
    expect(mockGetKnowledgePageByFqn).toHaveBeenLastCalledWith('otherFqn');
    expect(screen.getByTestId('page-version-content').textContent).toBe(
      'Other Title'
    );
  });
});
