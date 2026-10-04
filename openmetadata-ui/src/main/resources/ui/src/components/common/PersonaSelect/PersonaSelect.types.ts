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
import type { TreeSelectProps } from '@openmetadata/ui-core-components';
import { EntityReference } from '../../../generated/entity/type';

export interface PersonaSelectProps {
  /** Currently-selected persona, or undefined when none is set. */
  selectedPersona?: EntityReference;
  /** Fired with the picked persona, or undefined when the selection is cleared. */
  onUpdate: (persona?: EntityReference) => void | Promise<void>;
  hasPermission?: boolean;
  disabled?: boolean;
  triggerVariant?: 'input' | 'button';
  triggerClassName?: string;
  bordered?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Consumer-owned trigger (e.g. an edit pencil), rendered in place of the default. */
  renderTrigger?: TreeSelectProps<EntityReference>['renderTrigger'];
  label?: string;
  placeholder?: string;
  className?: string;
  'data-testid'?: string;
}
