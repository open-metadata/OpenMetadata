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

import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EventSubscription } from '../../generated/events/eventSubscription';
import { Paging } from '../../generated/type/paging';
import { AlertTableColumn } from './ObservabilityAlertsPage.constants';

export interface AlertPermission {
  id: string;
  edit: boolean;
  delete: boolean;
}

export interface UseObservabilityAlertsOptions {
  getAlertDetailsPath?: (fqn: string) => string;
  onAddAlert?: () => void;
  onViewAlert?: (alert: EventSubscription) => void;
}

export interface UseObservabilityAlertsReturn {
  alertPermissions?: AlertPermission[];
  alertResourcePermission?: OperationPermission;
  alerts: EventSubscription[];
  columnList: AlertTableColumn[];
  currentPage: number;
  getAlertDetailsPath: (fqn: string) => string;
  handleAddAlert: () => void;
  handleAlertDelete: () => Promise<void>;
  handlePageSizeChange: (page: number) => void;
  handleSelectAlert: (alert?: EventSubscription) => void;
  loading: boolean;
  loadingCount: number;
  onPageChange: (params: PagingHandlerParams) => void;
  onViewAlert?: (alert: EventSubscription) => void;
  paging: Paging;
  pageSize: number;
  selectedAlert?: EventSubscription;
  showPagination: boolean;
}

export interface ObservabilityAlertsHeaderProps {
  canCreate: boolean;
  onAddAlert: () => void;
}

export interface ObservabilityAlertActionsProps {
  alertPermission?: AlertPermission;
  loading: boolean;
  record: EventSubscription;
  onSelectAlert: (alert: EventSubscription) => void;
}

export interface ObservabilityAlertsTableProps {
  alertPermissions?: AlertPermission[];
  alerts: EventSubscription[];
  columnList: AlertTableColumn[];
  currentPage: number;
  loading: boolean;
  loadingCount: number;
  getAlertDetailsPath: (fqn: string) => string;
  onAddAlert: () => void;
  onPageChange: (params: PagingHandlerParams) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSelectAlert: (alert: EventSubscription) => void;
  onViewAlert?: (alert: EventSubscription) => void;
  paging: Paging;
  pageSize: number;
  showPagination: boolean;
}
