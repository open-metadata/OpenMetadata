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
import { render } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import FilesTable from '../../DriveService/File/FilesTable/FilesTable';
import SpreadsheetsTable from '../../DriveService/Spreadsheet/SpreadsheetsTable/SpreadsheetsTable';
import {
  ServiceFilesTab,
  ServiceSpreadsheetsTab,
} from './ServiceDriveAssetTabs';
import { useServiceDriveAssets } from './useServiceDriveAssets';

const mockList = {
  items: [{ name: 'asset' }],
  setItems: jest.fn(),
  isLoading: false,
  setIsLoading: jest.fn(),
  pagingInfo: { pageSize: 15 },
  onPageChange: jest.fn(),
};

jest.mock('./useServiceDriveAssets', () => ({
  useServiceDriveAssets: jest.fn(() => mockList),
}));

jest.mock('../../DriveService/File/FilesTable/FilesTable', () =>
  jest.fn(() => null)
);

jest.mock(
  '../../DriveService/Spreadsheet/SpreadsheetsTable/SpreadsheetsTable',
  () => jest.fn(() => null)
);

const onShowDeletedChange = jest.fn();

describe('ServiceDriveAssetTabs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the service files in the files table', () => {
    render(
      <ServiceFilesTab
        showDeleted
        serviceFqn="drive-svc"
        onShowDeletedChange={onShowDeletedChange}
      />
    );

    expect(useServiceDriveAssets).toHaveBeenCalledWith(
      EntityType.FILE,
      'drive-svc',
      true
    );
    expect(FilesTable).toHaveBeenCalledWith(
      expect.objectContaining({
        files: mockList.items,
        setFiles: mockList.setItems,
        isLoading: false,
        setIsLoading: mockList.setIsLoading,
        paging: mockList.pagingInfo,
        handlePageChange: mockList.onPageChange,
        handleShowDeleted: onShowDeletedChange,
        serviceFqn: 'drive-svc',
        showDeleted: true,
      }),
      expect.anything()
    );
    expect(SpreadsheetsTable).not.toHaveBeenCalled();
  });

  it('lists the service spreadsheets in the spreadsheets table', () => {
    render(
      <ServiceSpreadsheetsTab
        serviceFqn="drive-svc"
        showDeleted={false}
        onShowDeletedChange={onShowDeletedChange}
      />
    );

    expect(useServiceDriveAssets).toHaveBeenCalledWith(
      EntityType.SPREADSHEET,
      'drive-svc',
      false
    );
    expect(SpreadsheetsTable).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheets: mockList.items,
        setSpreadsheets: mockList.setItems,
        isLoading: false,
        setIsLoading: mockList.setIsLoading,
        paging: mockList.pagingInfo,
        handlePageChange: mockList.onPageChange,
        handleShowDeleted: onShowDeletedChange,
        serviceFqn: 'drive-svc',
        showDeleted: false,
      }),
      expect.anything()
    );
    expect(FilesTable).not.toHaveBeenCalled();
  });
});
