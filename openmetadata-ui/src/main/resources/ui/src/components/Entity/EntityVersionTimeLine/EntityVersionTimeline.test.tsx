/*
 *  Copyright 2024 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { ChangeDescription } from '../../../generated/entity/type';
import { EntityHistory } from '../../../generated/type/entityHistory';
import EntityVersionTimeLine, { VersionButton } from './EntityVersionTimeLine';

jest.mock('../../common/PopOverCard/UserPopOverCard', () => ({
  __esModule: true,
  default: ({ userName }: { userName: string }) => <p>{userName}</p>,
}));

const user = {
  name: 'John Doe displayName',
  displayName: 'John Doe displayName',
};

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest.fn().mockImplementation(() => [false, false, user]),
}));

jest.mock('../../../utils/EntityVersionUtils', () => ({
  __esModule: true,
  getSummary: jest.fn().mockReturnValue('Some change description'),
  isMajorVersion: jest.fn().mockReturnValue(false),
  renderVersionButton: jest.fn((v) => (
    <div
      data-testid={`version-selector-v${parseFloat(v.version).toFixed(1)}`}
      key={v.version}>
      {v.version}
    </div>
  )),
}));

jest.mock('../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest.fn().mockImplementation(() => ({
    resourceLimit: {},
    getResourceLimit: jest.fn(),
  })),
}));

describe('VersionButton', () => {
  const version = {
    updatedBy: 'John Doe',
    version: '1.0',
    changeDescription: {} as ChangeDescription,
    updatedAt: 123,
    glossary: '',
  };

  const onVersionSelect = jest.fn();
  const selected = false;
  const isMajorVersion = false;

  it('renders version number', () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );
    const versionNumber = screen.getByText('v1.0');

    expect(versionNumber).toBeInTheDocument();
  });

  it('renders change description', () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );
    const changeDescription = screen.getByText('Some change description');

    expect(changeDescription).toBeInTheDocument();
  });

  it('should render updatedBy with UserPopoverCard', async () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );

    const ownerDisplayName = await screen.findByText('John Doe');

    expect(ownerDisplayName).toBeInTheDocument();
  });

  it('calls onVersionSelect when clicked', () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );
    const versionButton = screen.getByTestId('version-selector-v1.0');
    fireEvent.click(versionButton);

    expect(onVersionSelect).toHaveBeenCalledWith('1.0');
  });
});

describe('EntityVersionTimeLine infinite scroll', () => {
  const versionList: EntityHistory = {
    entityType: 'table',
    versions: [
      JSON.stringify({ version: 1.1, updatedBy: 'u', updatedAt: 1 }),
      JSON.stringify({ version: 1.0, updatedBy: 'u', updatedAt: 0 }),
    ],
  };

  let observerCallback: IntersectionObserverCallback | undefined;

  class MockIO implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [];
    constructor(cb: IntersectionObserverCallback) {
      observerCallback = cb;
    }
    observe() {
      // noop
    }
    unobserve() {
      // noop
    }
    disconnect() {
      observerCallback = undefined;
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  beforeAll(() => {
    (
      window as unknown as { IntersectionObserver: typeof IntersectionObserver }
    ).IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;
  });

  beforeEach(() => {
    observerCallback = undefined;
  });

  const renderTimeline = (
    overrides: Partial<Parameters<typeof EntityVersionTimeLine>[0]> = {}
  ) =>
    render(
      <MemoryRouter>
        <EntityVersionTimeLine
          currentVersion="1.1"
          versionHandler={jest.fn()}
          versionList={versionList}
          onBack={jest.fn()}
          {...overrides}
        />
      </MemoryRouter>
    );

  it('does not render sentinel when hasMore is false', () => {
    renderTimeline({ hasMore: false, onLoadMore: jest.fn() });

    expect(
      screen.queryByTestId('version-load-more-sentinel')
    ).not.toBeInTheDocument();
  });

  it('does not render sentinel when onLoadMore is not provided', () => {
    renderTimeline({ hasMore: true });

    expect(
      screen.queryByTestId('version-load-more-sentinel')
    ).not.toBeInTheDocument();
  });

  it('renders sentinel when onLoadMore and hasMore are true', () => {
    renderTimeline({ hasMore: true, onLoadMore: jest.fn() });

    expect(
      screen.getByTestId('version-load-more-sentinel')
    ).toBeInTheDocument();
  });

  it('does not register the observer while isLoadingMore is true', () => {
    renderTimeline({
      hasMore: true,
      isLoadingMore: true,
      onLoadMore: jest.fn(),
    });

    expect(observerCallback).toBeUndefined();
  });
});
