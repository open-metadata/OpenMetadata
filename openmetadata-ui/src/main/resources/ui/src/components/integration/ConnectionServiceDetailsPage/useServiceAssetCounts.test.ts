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
import { act, renderHook, waitFor } from '@testing-library/react';
import { EntityTabs } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { Include } from '../../../generated/type/include';
import {
  countServiceChildren,
  getSecondaryAssetTabs,
} from './connectionServiceChildren.utils';
import { useServiceAssetCounts } from './useServiceAssetCounts';

const mockCountFiles = jest.fn();
const mockCountSpreadsheets = jest.fn();

jest.mock('./connectionServiceChildren.utils', () => ({
  countServiceChildren: jest.fn(),
  getSecondaryAssetTabs: jest.fn(),
}));

const renderCounts = (
  serviceFqn = 'drive-svc',
  include: Include = Include.NonDeleted
) =>
  renderHook(
    (props) =>
      useServiceAssetCounts(
        ServiceCategory.DRIVE_SERVICES,
        props.serviceFqn,
        props.include
      ),
    { initialProps: { serviceFqn, include } }
  );

describe('useServiceAssetCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (countServiceChildren as jest.Mock).mockResolvedValue(9);
    mockCountFiles.mockResolvedValue(3);
    mockCountSpreadsheets.mockResolvedValue(0);
    (getSecondaryAssetTabs as jest.Mock).mockReturnValue([
      { key: EntityTabs.FILES, countAssets: mockCountFiles },
      { key: EntityTabs.SPREADSHEETS, countAssets: mockCountSpreadsheets },
    ]);
  });

  it('counts the data assets and each secondary tab, keyed by tab', async () => {
    const { result } = renderCounts();

    await waitFor(() =>
      expect(result.current).toEqual({
        dataAssets: 9,
        files: 3,
        spreadsheets: 0,
      })
    );

    expect(countServiceChildren).toHaveBeenCalledWith(
      ServiceCategory.DRIVE_SERVICES,
      'drive-svc',
      Include.NonDeleted
    );
    expect(mockCountFiles).toHaveBeenCalledWith(
      'drive-svc',
      Include.NonDeleted
    );
  });

  it('waits for the service to load before counting', () => {
    const { result } = renderCounts('');

    expect(countServiceChildren).not.toHaveBeenCalled();
    expect(result.current).toEqual({});
  });

  it('leaves out a count that fails, keeping the rest', async () => {
    mockCountFiles.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderCounts();

    await waitFor(() =>
      expect(result.current).toEqual({ dataAssets: 9, spreadsheets: 0 })
    );
  });

  it('leaves out a category that counts no data assets', async () => {
    (countServiceChildren as jest.Mock).mockResolvedValueOnce(undefined);
    const { result } = renderCounts();

    await waitFor(() =>
      expect(result.current).toEqual({ files: 3, spreadsheets: 0 })
    );
  });

  it('keeps the counts of the current Deleted setting when an earlier answer lands after them', async () => {
    const pending: Array<(total: number) => void> = [];
    (countServiceChildren as jest.Mock)
      .mockImplementationOnce(
        () => new Promise((resolve) => pending.push(resolve))
      )
      .mockResolvedValueOnce(2);
    const { result, rerender } = renderCounts();

    rerender({ serviceFqn: 'drive-svc', include: Include.Deleted });
    await waitFor(() => expect(result.current.dataAssets).toBe(2));

    await act(async () => pending[0](9));

    expect(result.current.dataAssets).toBe(2);
  });
});
