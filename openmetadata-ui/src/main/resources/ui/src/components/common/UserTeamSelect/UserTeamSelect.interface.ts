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

import { EntityReference } from '../../../generated/entity/data/table';

export interface UserTeamSelectProps {
  /** Selected values (users and teams) */
  value?: EntityReference[];
  /** Callback when selection changes */
  onChange?: (value: EntityReference[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Configure multiple selection for users and teams */
  multiple?: {
    user: boolean;
    team: boolean;
  };
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Whether to show search functionality */
  showSearch?: boolean;
  /** Whether to show clear button */
  allowClear?: boolean;
  /** Size of the select component */
  size?: 'small' | 'middle' | 'large';
  /** Additional CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Label for accessibility */
  label?: string;
  /** Maximum height for options container */
  optionsHeight?: number;
  /** Whether to show user count badges */
  showCount?: boolean;
  /** Default active tab */
  defaultActiveTab?: 'teams' | 'users';
}

export interface UserTeamSelectRef {
  /** Clear all selections */
  clear: () => void;
  /** Focus the select component */
  focus: () => void;
  /** Blur the select component */
  blur: () => void;
  /** Get current form values */
  getValue: () => EntityReference[];
}
