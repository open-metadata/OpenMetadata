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

import { ReactNode } from 'react';
import { EntityType } from '../../../enums/entity.enum';

export interface DeleteOption {
  title: string;
  description: ReactNode;
  type: DeleteType;
  isAllowed: boolean;
}

export interface DeleteWidgetModalProps {
  visible: boolean;
  onCancel: () => void;
  allowSoftDelete?: boolean;
  deleteMessage?: string;
  softDeleteMessagePostFix?: string;
  hardDeleteMessagePostFix?: string;
  entityName: string;
  entityType: EntityType;
  isAdminUser?: boolean;
  entityId?: string;
  isAsyncDelete?: boolean;
  prepareType?: boolean;
  isRecursiveDelete?: boolean;
  successMessage?: string;
  deleteOptions?: DeleteOption[];
  afterDeleteAction?: (isSoftDelete?: boolean, version?: number) => void;
  onDelete?: (data: DeleteWidgetFormFields) => void;
  isDeleting?: boolean;
}

export enum DeleteType {
  SOFT_DELETE = 'soft-delete',
  HARD_DELETE = 'hard-delete',
}

export type DeleteWidgetFormFields = {
  deleteType: DeleteType;
  deleteTextInput: string;
};
