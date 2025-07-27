/*
 *  Copyright 2024 Collate.
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
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityName } from '../../../Modals/EntityNameModal/EntityNameModal.interface';
import { DeleteOption } from '../../DeleteWidget/DeleteWidget.interface';

export interface ManageButtonProps {
  allowSoftDelete?: boolean;
  afterDeleteAction?: (isSoftDelete?: boolean, version?: number) => void;
  buttonClassName?: string;
  entityName: string;
  entityId?: string;
  entityType: EntityType;
  displayName?: string;
  entityFQN?: string;
  isRecursiveDelete?: boolean;
  deleteMessage?: string;
  softDeleteMessagePostFix?: string;
  hardDeleteMessagePostFix?: string;
  canDelete?: boolean;
  isAsyncDelete?: boolean;
  extraDropdownContent?: ItemType[];
  onAnnouncementClick?: () => void;
  onRestoreEntity?: () => Promise<void>;
  deleted?: boolean;
  editDisplayNamePermission?: boolean;
  onEditDisplayName?: (data: EntityName) => Promise<void>;
  allowRename?: boolean;
  prepareType?: boolean;
  successMessage?: string;
  deleteButtonDescription?: string;
  deleteOptions?: DeleteOption[];
  onProfilerSettingUpdate?: () => void;
}
