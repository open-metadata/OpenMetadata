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
import { FormSelectItem } from '@openmetadata/ui-core-components';
import { DefaultOptionType } from 'antd/lib/select';
import { Dispatch, SetStateAction } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import {
  ContextMemory,
  EntityReference,
  MemoryType,
  ShareVisibility,
  TagLabel,
} from '../../../generated/entity/context/contextMemory';
import tagClassBase from '../../../utils/TagClassBase';

export interface CreateMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  memoryToEdit?: ContextMemory;
  onUpdated?: () => void;
  onDeleted?: () => void;
  onEditMemory?: (memory: ContextMemory) => void;
  viewOnly?: boolean;
  isAdminUser?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  currentUserName?: string;
}

export interface MemoryFormValues {
  title: string;
  memory: string;
  memoryType: FormSelectItem | null;
  visibility: ShareVisibility;
}

export type TFunc = (key: string, options?: Record<string, unknown>) => string;

export interface MemoryModalHeaderProps {
  modalTitle: string;
  memoryToEdit?: ContextMemory;
  memorySource?: EntityReference;
  memorySourceLink?: string;
  t: TFunc;
}

export interface ReadOnlyBannerProps {
  isViewOnly: boolean;
  isOwner: boolean;
  canDelete: boolean;
  memoryToEdit?: ContextMemory;
  t: TFunc;
}

export interface LinkedAssetsSectionProps {
  isViewOnly: boolean;
  linkedAssets: DataAssetOption[];
  setLinkedAssets: Dispatch<SetStateAction<DataAssetOption[]>>;
  handleAssetChange: (option?: DataAssetOption | DataAssetOption[]) => void;
  t: TFunc;
}

export interface MemoryMetadataCardProps {
  form: UseFormReturn<MemoryFormValues>;
  isEditingVisibility: boolean;
  setIsEditingVisibility: Dispatch<SetStateAction<boolean>>;
  memoryToEdit?: ContextMemory;
  isViewOnly: boolean;
  isOwner: boolean;
  selectedTags: TagLabel[];
  handleRemoveTag: (tagFQN: string) => void;
  showTagForm: boolean;
  setShowTagForm: Dispatch<SetStateAction<boolean>>;
  fetchTagOptions: (
    searchText: string,
    page: number
  ) => ReturnType<typeof tagClassBase.getTags>;
  handleTagSave: (
    tags: DefaultOptionType | DefaultOptionType[]
  ) => Promise<void>;
  t: TFunc;
}

export interface MemoryModalFooterProps {
  memoryToEdit?: ContextMemory;
  canDelete: boolean;
  isDeleting: boolean;
  isSubmitting: boolean;
  handleDelete: () => void;
  handleClose: () => void;
  showEditButton: boolean | undefined;
  handleSwitchToEdit: () => void;
  showSubmitButton: boolean | undefined;
  isSubmitDisabled: boolean;
  submitLabel: string;
  t: TFunc;
}

export interface SubmitMemoryFields {
  title: string;
  memory: string;
  memoryTypeValue: MemoryType | undefined;
  visibility: ShareVisibility;
  selectedTags: TagLabel[];
  primaryEntity: EntityReference | undefined;
  relatedEntities: EntityReference[];
}

export interface SubmitMemoryUpdateParams extends SubmitMemoryFields {
  memoryToEdit: ContextMemory;
  t: (key: string, options?: Record<string, unknown>) => string;
  onUpdated?: () => void;
}

export interface SubmitMemoryCreateParams extends SubmitMemoryFields {
  t: (key: string, options?: Record<string, unknown>) => string;
  onCreated: () => void;
}

export interface MemoryFormState {
  formValues: MemoryFormValues;
  tags: TagLabel[];
  assets: DataAssetOption[];
}
