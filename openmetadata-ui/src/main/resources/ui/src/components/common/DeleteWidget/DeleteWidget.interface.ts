/*
 *  Copyright 2021 Collate
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

export interface DeleteWidgetV1Props {
  visible: boolean;
  onCancel: () => void;
  allowSoftDelete?: boolean;
  entityName: string;
  entityType: string;
  isAdminUser?: boolean;
  entityId: string;
  isRecursiveDelete?: boolean;
  afterDeleteAction?: () => void;
}

export interface DeleteSectionProps {
  allowSoftDelete?: boolean;
  entityName: string;
  entityType: string;
  deletEntityMessage?: string;
  hasPermission: boolean;
  isAdminUser?: boolean;
  entityId: string;
  isRecursiveDelete?: boolean;
  afterDeleteAction?: () => void;
}

export enum DeleteType {
  SOFT_DELETE = 'soft-delete',
  HARD_DELETE = 'hard-delete',
}
