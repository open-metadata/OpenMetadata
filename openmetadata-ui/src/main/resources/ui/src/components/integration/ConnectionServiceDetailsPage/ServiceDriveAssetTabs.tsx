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
import { EntityType } from '../../../enums/entity.enum';
import { File } from '../../../generated/entity/data/file';
import { Spreadsheet } from '../../../generated/entity/data/spreadsheet';
import FilesTable from '../../DriveService/File/FilesTable/FilesTable';
import SpreadsheetsTable from '../../DriveService/Spreadsheet/SpreadsheetsTable/SpreadsheetsTable';
import { useServiceDriveAssets } from './useServiceDriveAssets';

interface ServiceDriveAssetTabProps {
  serviceFqn: string;
  showDeleted: boolean;
  onShowDeletedChange: (value: boolean) => void;
}

export const ServiceFilesTab = ({
  serviceFqn,
  showDeleted,
  onShowDeletedChange,
}: ServiceDriveAssetTabProps) => {
  const files = useServiceDriveAssets<File>(
    EntityType.FILE,
    serviceFqn,
    showDeleted
  );

  return (
    <FilesTable
      files={files.items}
      handlePageChange={files.onPageChange}
      handleShowDeleted={onShowDeletedChange}
      isLoading={files.isLoading}
      paging={files.pagingInfo}
      serviceFqn={serviceFqn}
      setFiles={files.setItems}
      setIsLoading={files.setIsLoading}
      showDeleted={showDeleted}
    />
  );
};

export const ServiceSpreadsheetsTab = ({
  serviceFqn,
  showDeleted,
  onShowDeletedChange,
}: ServiceDriveAssetTabProps) => {
  const spreadsheets = useServiceDriveAssets<Spreadsheet>(
    EntityType.SPREADSHEET,
    serviceFqn,
    showDeleted
  );

  return (
    <SpreadsheetsTable
      handlePageChange={spreadsheets.onPageChange}
      handleShowDeleted={onShowDeletedChange}
      isLoading={spreadsheets.isLoading}
      paging={spreadsheets.pagingInfo}
      serviceFqn={serviceFqn}
      setIsLoading={spreadsheets.setIsLoading}
      setSpreadsheets={spreadsheets.setItems}
      showDeleted={showDeleted}
      spreadsheets={spreadsheets.items}
    />
  );
};
