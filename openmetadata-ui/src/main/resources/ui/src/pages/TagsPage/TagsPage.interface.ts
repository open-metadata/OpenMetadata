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

import { FormSelectItem } from '@openmetadata/ui-core-components';
import { LoadingState } from 'Models';
import { MutableRefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CreateClassification } from '../../generated/api/classification/createClassification';
import { CreateTag } from '../../generated/api/classification/createTag';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { EntityReference } from '../../generated/entity/type';

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

export interface TagFormSelectItem extends FormSelectItem {
  value: EntityReference | string;
}

export interface TagFormValues {
  id?: string;
  name: string;
  displayName?: string;
  description?: string;
  style?: {
    color?: string;
    iconURL?: string;
  };
  disabled?: boolean;
  mutuallyExclusive?: boolean;
  owners?: TagFormSelectItem[];
  domains?: TagFormSelectItem[];
}

export const TAG_FORM_DEFAULTS: TagFormValues = {
  id: '',
  name: '',
  displayName: '',
  description: '',
  owners: [],
  domains: [],
};

export interface RenameFormProps {
  form: UseFormReturn<TagFormValues>;
  submitRef?: MutableRefObject<() => void>;
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
  form: UseFormReturn<TagFormValues>;
  classifications: Classification[];
  isTier: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (data: CreateClassification) => Promise<void>;
}

export interface TagFormDrawerProps {
  open: boolean;
  editTag?: Tag;
  form: UseFormReturn<TagFormValues>;
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
