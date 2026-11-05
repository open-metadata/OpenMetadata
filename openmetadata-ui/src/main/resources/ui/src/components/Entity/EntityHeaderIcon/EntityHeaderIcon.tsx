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
import classNames from 'classnames';
import { ReactNode } from 'react';

// Fixed-size badge so the header icon keeps the same size and alignment
// whether the title has one line (name) or two (display name + name).
export const EntityHeaderIcon = ({ children }: { children: ReactNode }) => (
  <div
    className={classNames(
      'tw:relative tw:flex tw:size-9 tw:shrink-0 tw:items-center',
      'tw:justify-center tw:overflow-hidden tw:rounded-full',
      'tw:bg-surface tw:border tw:border-border-secondary tw:shadow-xs-skeumorphic'
    )}
    data-testid="entity-header-icon">
    <span className="tw:flex tw:size-5 tw:items-center tw:justify-center tw:text-utility-blue-700">
      {children}
    </span>
  </div>
);
