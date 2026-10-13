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
import { VersionBadgeButton } from './VersionBadgeButton.component';
import { VersionHistorySlideout } from './VersionHistorySlideout.component';
import { VersionHistoryItem } from './VersionHistorySlideout.interface';

jest.mock('../Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

const ENTRIES: VersionHistoryItem[] = [
  {
    version: '0.2',
    isCurrent: true,
    updatedBy: 'aaron',
    updatedAt: Date.now(),
    summary: <p>Owners updated</p>,
  },
  { version: '0.1', isCurrent: false, updatedBy: 'admin', updatedAt: 1000 },
];

const onClose = jest.fn();

const renderSlideout = (
  props: Partial<Parameters<typeof VersionHistorySlideout>[0]> = {}
) =>
  render(
    <VersionHistorySlideout
      isOpen
      emptyMessage="nothing yet"
      entries={ENTRIES}
      isLoading={false}
      testId="history"
      onClose={onClose}
      {...props}
    />
  );

describe('VersionHistorySlideout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists each version with what changed and who changed it', () => {
    renderSlideout({
      renderAction: (entry) => <button>{`act-${entry.version}`}</button>,
      subtitle: 'every edit',
    });

    expect(screen.getByTestId('version-dot-0.2')).toBeInTheDocument();
    expect(screen.getByTestId('version-dot-0.1')).toBeInTheDocument();
    expect(screen.getByText('label.current')).toBeInTheDocument();
    expect(screen.getByText('Owners updated')).toBeInTheDocument();
    expect(screen.getByText('aaron')).toBeInTheDocument();
    expect(screen.getByText('every edit')).toBeInTheDocument();
    expect(screen.getByText('act-0.1')).toBeInTheDocument();
  });

  it('shows a loader while the first load is in flight', () => {
    renderSlideout({ entries: [], isLoading: true });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('keeps the versions in view while they reload', () => {
    renderSlideout({ isLoading: true });

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    expect(screen.getByTestId('version-dot-0.2')).toBeInTheDocument();
  });

  it('says so when there is no history', () => {
    renderSlideout({ entries: [] });

    expect(screen.getByText('nothing yet')).toBeInTheDocument();
  });

  it('closes from its close button', () => {
    renderSlideout();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe('VersionBadgeButton', () => {
  it('shows the version and opens the history when pressed', () => {
    const onPress = jest.fn();
    render(
      <VersionBadgeButton testId="badge" version="1.2" onPress={onPress} />
    );

    fireEvent.click(screen.getByTestId('badge'));

    expect(screen.getByTestId('badge')).toHaveTextContent(
      'label.version-short'
    );
    expect(onPress).toHaveBeenCalled();
  });
});
