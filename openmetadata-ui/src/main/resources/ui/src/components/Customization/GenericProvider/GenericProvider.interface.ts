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
import { CustomizeEntityType } from '../../../constants/Customize.constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { DataAssetRuleValidation } from '../../../context/RuleEnforcementProvider/RuleEnforcementProvider.interface';
import { Column } from '../../../generated/entity/data/table';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { EntityReference } from '../../../generated/entity/type';
import { Page } from '../../../generated/system/ui/page';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { ColumnOrTask } from '../../Database/ColumnDetailPanel/ColumnDetailPanel.interface';

export interface GenericProviderProps<T extends Omit<EntityReference, 'type'>> {
  children?: React.ReactNode;
  data: T;
  type: CustomizeEntityType;
  onUpdate: (updatedData: T, key?: keyof T) => Promise<void>;
  onEntitySync?: (updatedData: T) => void;
  isVersionView?: boolean;
  permissions: OperationPermission;
  currentVersionData?: T;
  isTabExpanded?: boolean;
  customizedPage?: Page | null;
  muiTags?: boolean;
  columnFqn?: string;
  onColumnsUpdate?: (columns: Column[]) => void;
}

export interface GenericContextType<T extends Omit<EntityReference, 'type'>> {
  data: T;
  type: CustomizeEntityType;
  onUpdate: (updatedData: T, key?: keyof T) => Promise<void>;
  isVersionView?: boolean;
  permissions: OperationPermission;
  currentVersionData?: T;
  onThreadLinkSelect: (link: string, threadType?: ThreadType) => void;
  layout: WidgetConfig[];
  filterWidgets?: (widgets: string[]) => void;
  updateWidgetHeight: (widgetId: string, height: number) => void;
  activeTagDropdownKey: string | null;
  updateActiveTagDropdownKey: (key: string | null) => void;
  muiTags: boolean;
  entityRules: DataAssetRuleValidation;
  selectedColumn: ColumnOrTask | null;
  isColumnDetailOpen: boolean;
  openColumnDetailPanel: (column: ColumnOrTask) => void;
  closeColumnDetailPanel: () => void;
  setDisplayedColumns: (columns: ColumnOrTask[]) => void;
}
