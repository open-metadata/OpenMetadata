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
import FilesTable from '../../DriveService/File/FilesTable/FilesTable';
import { useDriveAssetList } from './useDriveAssetList';

interface DriveFilesTabProps {
  serviceFqn: string;
  showDeleted: boolean;
  onShowDeletedChange: (value: boolean) => void;
}

const DriveFilesTab = ({
  serviceFqn,
  showDeleted,
  onShowDeletedChange,
}: DriveFilesTabProps) => {
  const {
    assets,
    setAssets,
    isLoading,
    setIsLoading,
    pagingInfo,
    handleAssetPageChange,
  } = useDriveAssetList<File>({
    entityType: EntityType.FILE,
    searchParam: 'file',
    serviceFqn,
    showDeleted,
  });

  return (
    <FilesTable
      files={assets}
      handlePageChange={handleAssetPageChange}
      handleShowDeleted={onShowDeletedChange}
      isLoading={isLoading}
      paging={pagingInfo}
      serviceFqn={serviceFqn}
      setFiles={setAssets}
      setIsLoading={setIsLoading}
      showDeleted={showDeleted}
    />
  );
};

export default DriveFilesTab;
