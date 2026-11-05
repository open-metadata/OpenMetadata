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

import { DatabaseService } from '@openmetadata/ui-core-components/icons';
import { ReactNode } from 'react';

export interface ServiceSectionCardProps {
  title: string;
  description: string;
  /** Rendered at the top right, beside the title. */
  actions?: ReactNode;
  testId: string;
  children: ReactNode;
}

/**
 * One titled section on the service Connection tab.
 *
 * <p>Connection configuration and the service's own governance attributes are different kinds of
 * metadata that happen to share a tab, so each gets its own card with its own heading and actions
 * rather than running together inside a single bordered panel.
 */
const ServiceSectionCard = ({
  title,
  description,
  actions,
  testId,
  children,
}: ServiceSectionCardProps) => (
  <div
    className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-5 tw:shadow-xs"
    data-testid={testId}>
    <div className="tw:flex tw:items-start tw:justify-between tw:gap-4">
      <div className="tw:flex tw:items-start tw:gap-3">
        <span className="tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary">
          <DatabaseService className="tw:size-5 tw:text-brand-secondary" />
        </span>
        <div>
          <div className="tw:text-sm tw:font-semibold tw:leading-6 tw:text-primary">
            {title}
          </div>
          <div className="tw:mt-0.5 tw:text-xs tw:text-tertiary">
            {description}
          </div>
        </div>
      </div>
      {actions && (
        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
          {actions}
        </div>
      )}
    </div>

    <div className="tw:my-4 tw:border-t tw:border-secondary" />

    {children}
  </div>
);

export default ServiceSectionCard;
