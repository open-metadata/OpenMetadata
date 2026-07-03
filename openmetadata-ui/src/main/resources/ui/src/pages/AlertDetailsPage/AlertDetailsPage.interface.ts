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

import type { TabsProps } from 'antd';
import type { ReactNode } from 'react';
import { AlertDetailTabs } from '../../enums/Alerts.enum';
import {
  EntityReference,
  EventSubscription,
} from '../../generated/events/eventSubscription';

export interface AlertDetailsPageProps {
  afterDeleteAction?: () => Promise<void> | void;
  fqn?: string;
  isNotificationAlert?: boolean;
  onEditAlert?: (fqn: string) => void;
  onTabChange?: (tab: AlertDetailTabs) => void;
  tab?: AlertDetailTabs;
}

export interface AlertDetailsPermissions {
  deletePermission: boolean;
  editDescriptionPermission: boolean;
  editOwnersPermission: boolean;
  editPermission: boolean;
  viewPermission: boolean;
}

export interface UseAlertDetailsPageReturn extends AlertDetailsPermissions {
  alertDetails?: EventSubscription;
  alertIcon: ReactNode;
  breadcrumb: {
    name: string;
    url: string;
  }[];
  extraInfo: ReactNode;
  handleAlertDelete: () => Promise<void>;
  handleAlertEdit: () => Promise<void>;
  handleAlertSync: () => Promise<void>;
  handleTabChange: (activeKey: string) => void;
  hideDeleteModal: () => void;
  isSyncing: boolean;
  loadingCount: number;
  onDescriptionUpdate: (description: string) => Promise<void>;
  onOwnerUpdate: (owners?: EntityReference[]) => Promise<void>;
  ownerLoading: boolean;
  setShowDeleteModal: (show: boolean) => void;
  showDeleteModal: boolean;
  tab: AlertDetailTabs;
  tabItems: TabsProps['items'];
}

export type AlertDetailsContentProps = UseAlertDetailsPageReturn;
