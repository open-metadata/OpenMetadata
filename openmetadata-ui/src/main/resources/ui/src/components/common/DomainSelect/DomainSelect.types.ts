/*
 *  Copyright 2025 Collate.
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
import type {
  TreeSelectProps,
  TreeSelectTriggerVariant,
} from '@openmetadata/ui-core-components';
import { EntityReference } from '../../../generated/entity/type';

export interface DomainSelectProps {
  /** Currently-assigned domain(s). */
  selectedDomain?: EntityReference | EntityReference[];
  /** Allow selecting more than one domain. @default false */
  multiple?: boolean;
  disabled?: boolean;
  /** When explicitly `false`, the selector is disabled. */
  hasPermission?: boolean;
  /**
   * Allow clearing the last selection in single mode. Mirrors the legacy
   * `DomainSelectableList` prop. @default true
   */
  isClearable?: boolean;
  /** Domains that must not be offered for selection (filtered from results). */
  restrictedDomains?: EntityReference[];
  /**
   * Called with the new selection. In single mode receives one reference (or
   * `undefined` when cleared); in multiple mode receives the full array.
   */
  onUpdate: (
    domain: EntityReference | EntityReference[] | undefined
  ) => Promise<void> | void;
  /** Reserved for parity with the legacy picker; not yet wired to a cancel. */
  onCancel?: () => void;

  /** @default 'input' */
  triggerVariant?: TreeSelectTriggerVariant;
  bordered?: boolean;
  /**
   * Buffer selection until Apply (`staged`) or report every toggle
   * (`immediate`). Defaults to `immediate` for the input field and `staged`
   * for the button / custom trigger (the edit-popover pattern).
   */
  commitMode?: 'immediate' | 'staged';
  renderTrigger?: TreeSelectProps<EntityReference>['renderTrigger'];
  label?: string;
  placeholder?: string;

  /** Inline "create domain" action; receives the current search term. */
  onCreate?: (searchTerm: string) => void;
  /** Label for the inline create row (required to render it). */
  createLabel?: string;

  'data-testid'?: string;
}
