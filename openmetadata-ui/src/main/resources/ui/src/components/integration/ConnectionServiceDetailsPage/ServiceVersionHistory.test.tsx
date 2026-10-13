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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ServiceCategory } from '../../../enums/service.enum';
import { getServiceVersions } from '../../../rest/serviceAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  ServiceVersionHistory,
  toServiceVersionHistory,
} from './ServiceVersionHistory';

jest.mock('../../../rest/serviceAPI', () => ({
  getServiceVersions: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/EntityVersionUtils', () => ({
  getSummary: jest.fn(() => 'summary'),
}));

const snapshot = (version: number, updatedBy = 'admin') =>
  JSON.stringify({
    version,
    updatedBy,
    updatedAt: version * 1000,
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [],
      fieldsDeleted: [],
    },
  });

const HISTORY = {
  entityType: 'databaseService',
  versions: [snapshot(0.1), snapshot(0.3, 'aaron'), snapshot(0.2)],
};

const renderHistory = () =>
  render(
    <ServiceVersionHistory
      serviceCategory={ServiceCategory.DATABASE_SERVICES}
      serviceId="svc-1"
      version={0.3}
    />
  );

describe('toServiceVersionHistory', () => {
  it('lists the versions newest first, marking the latest as current', () => {
    const entries = toServiceVersionHistory(HISTORY);

    expect(entries.map(({ version }) => version)).toEqual([
      '0.3',
      '0.2',
      '0.1',
    ]);
    expect(entries.map(({ isCurrent }) => isCurrent)).toEqual([
      true,
      false,
      false,
    ]);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        updatedBy: 'aaron',
        updatedAt: 300,
        summary: 'summary',
      })
    );
  });

  it('lists nothing for an empty history', () => {
    expect(toServiceVersionHistory({ entityType: 'x', versions: [] })).toEqual(
      []
    );
  });
});

describe('ServiceVersionHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServiceVersions as jest.Mock).mockResolvedValue(HISTORY);
  });

  it('shows the current version, and loads the history only once opened', async () => {
    renderHistory();

    expect(
      screen.getByTestId('service-version-history-button')
    ).toHaveTextContent('label.version-short');
    expect(getServiceVersions).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('service-version-history-button'));

    expect(await screen.findByTestId('version-dot-0.3')).toBeInTheDocument();
    expect(getServiceVersions).toHaveBeenCalledWith(
      ServiceCategory.DATABASE_SERVICES,
      'svc-1'
    );
  });

  it('says why when the history cannot be loaded', async () => {
    const error = new Error('boom');
    (getServiceVersions as jest.Mock).mockRejectedValueOnce(error);
    renderHistory();

    fireEvent.click(screen.getByTestId('service-version-history-button'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));
  });

  it('keeps the latest history when an earlier request resolves after it', async () => {
    const pending: Array<(value: typeof HISTORY) => void> = [];
    (getServiceVersions as jest.Mock)
      .mockImplementationOnce(
        () => new Promise((resolve) => pending.push(resolve))
      )
      .mockResolvedValueOnce({ entityType: 'x', versions: [snapshot(0.5)] });
    renderHistory();
    const openButton = screen.getByTestId('service-version-history-button');

    fireEvent.click(openButton);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    fireEvent.click(openButton);

    expect(await screen.findByTestId('version-dot-0.5')).toBeInTheDocument();

    await act(async () => pending[0](HISTORY));

    expect(screen.getByTestId('version-dot-0.5')).toBeInTheDocument();
    expect(screen.queryByTestId('version-dot-0.3')).not.toBeInTheDocument();
  });
});
