/*
 *  Copyright 2022 Collate.
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

import { FormInstance } from 'antd';
import { LoadingState } from 'Models';
import { CreateClassification } from '../../generated/api/classification/createClassification';
import { CreateTag } from '../../generated/api/classification/createTag';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';

export type DeleteTagDetailsType = {
  id: string;
  name: string;
  categoryName?: string;
  isCategory: boolean;
  status?: LoadingState;
};

export type DeleteTagsType = {
  data: DeleteTagDetailsType | undefined;
  state: boolean;
};

export interface RenameFormProps {
  formRef: FormInstance<Classification | Tag | undefined>;
  isEditing: boolean;
  isTier: boolean;
  initialValues?: Classification | Tag;
  onSubmit: (value: CreateClassification | CreateTag) => Promise<void>;
  showMutuallyExclusive?: boolean;
  isClassification?: boolean;
  data?: Classification[];
  isSystemTag?: boolean;
  permissions?: {
    createTags?: boolean;
    editDescription?: boolean;
    editDisplayName?: boolean;
    editAll?: boolean;
  };
}

export interface ClassificationFormDrawerProps {
  open: boolean;
  formRef: FormInstance;
  classifications: Classification[];
  isTier: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (data: CreateClassification) => Promise<void>;
}

export interface TagFormDrawerProps {
  open: boolean;
  editTag?: Tag;
  formRef: FormInstance;
  isTier: boolean;
  isLoading: boolean;
  permissions: {
    createTags: boolean;
    editAll: boolean;
    editDescription: boolean;
    editDisplayName: boolean;
  };
  tagsFormHeader: string;
  onClose: () => void;
  onSubmit: (data: CreateTag) => Promise<void>;
}
