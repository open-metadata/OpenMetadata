/*
 *  Copyright 2025 Collate.
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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { File } from '../../../generated/entity/data/file';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../Database/TableQueries/TableQueries.interface';

export interface FileDetailsProps {
  fileDetails: File;
  filePermissions: OperationPermission;
  fetchFile: () => Promise<void>;
  followFileHandler: () => Promise<void>;
  handleToggleDelete: (version?: number | undefined) => void;
  unFollowFileHandler: () => Promise<void>;
  updateFileDetailsState: (data: DataAssetWithDomains) => void;
  versionHandler: () => void;
  onFileUpdate: (updatedData: File, key?: keyof File) => Promise<void>;
  onUpdateVote: (data: QueryVote, id: string) => Promise<void>;
}
