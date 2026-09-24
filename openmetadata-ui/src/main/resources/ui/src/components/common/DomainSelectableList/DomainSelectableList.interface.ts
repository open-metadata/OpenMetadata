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
import { ReactNode } from 'react';
import { EntityReference } from '../../../generated/entity/type';

/**
 * Minimal controlled-open contract for the picker popover. Replaces the antd
 * `PopoverProps` the legacy Ant Design version accepted; DomainSelect only
 * consumes `open`/`onOpenChange` (placement is accepted for call-site
 * compatibility but the ui-core TreeSelect auto-places its dropdown).
 */
export interface DomainSelectablePopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: string;
}

export interface DomainSelectableListProps {
  children?: ReactNode;
  disabled?: boolean;
  getPopupContainer?: (trigger?: HTMLElement) => HTMLElement;
  hasPermission: boolean;
  multiple?: boolean;
  onCancel?: () => void;
  onUpdate: (domain: EntityReference | EntityReference[]) => Promise<void>;
  popoverProps?: DomainSelectablePopoverProps;
  restrictedDomains?: EntityReference[];
  selectedDomain?: EntityReference | EntityReference[];
  showAllDomains?: boolean;
  wrapInButton?: boolean;
  overlayClassName?: string;
  isClearable?: boolean;
  /** Applied to the ui-core TreeSelect trigger wrapper — e.g. `tw:w-full` to
   * let a full-width custom trigger fill its container. */
  className?: string;
  'data-testid'?: string;
}
