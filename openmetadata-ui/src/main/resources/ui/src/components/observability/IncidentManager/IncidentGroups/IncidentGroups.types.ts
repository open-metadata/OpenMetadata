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

import { FC, ReactNode } from 'react';
import { IncidentGroupBy } from '../../../../generated/tests/testCaseIncidentGroup';

export interface IncidentGroupByOption {
  key: IncidentGroupBy;
  /** i18n key of the dimension label. */
  labelKey: string;
  icon: FC<{ className?: string }>;
}

export interface IncidentGroupByDropdownProps {
  value: IncidentGroupBy;
  onChange: (groupBy: IncidentGroupBy) => void;
}

export interface IncidentGroupsViewProps {
  /**
   * Rendered once the groups are loaded. The group table lands here; until then
   * the view carries the dimension picker and the loading/empty/error states.
   */
  children?: ReactNode;
}
