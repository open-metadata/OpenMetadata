/*
 *  Copyright 2023 Collate.
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
import { Classification } from '../../../generated/entity/classification/classification';
import { Tag } from '../../../generated/entity/classification/tag';
import { DeleteTagsType } from '../../../pages/TagsPage/TagsPage.interface';

export interface ClassificationDetailsProps {
  classificationPermissions: OperationPermission;
  isVersionView?: boolean;
  currentClassification?: Classification;
  deleteTags?: DeleteTagsType;
  isAddingTag?: boolean;
  disableEditButton?: boolean;
  handleAfterDeleteAction?: () => void;
  handleEditTagClick?: (selectedTag: Tag) => void;
  handleActionDeleteTag?: (record: Tag) => void;
  handleAddNewTagClick?: () => void;
  handleUpdateClassification?: (
    updatedClassification: Classification
  ) => Promise<void>;
}
export interface ClassificationDetailsRef {
  refreshClassificationTags: () => void;
}
