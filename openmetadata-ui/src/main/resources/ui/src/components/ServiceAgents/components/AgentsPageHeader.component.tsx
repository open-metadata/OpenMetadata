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

import { Badge } from '@openmetadata/ui-core-components';
import { FC, Fragment } from 'react';
import { ServiceInfo } from '../AgentsPage.interface';

interface AgentsPageHeaderProps {
  service: ServiceInfo;
}

const AgentsPageHeader: FC<AgentsPageHeaderProps> = ({ service }) => (
  <div className="tw:mb-5">
    <div className="tw:flex tw:items-center tw:gap-2 tw:mb-4 tw:text-sm tw:font-medium tw:text-[color:var(--fg-tertiary)]">
      {service.breadcrumb.map((crumb, index) => (
        <Fragment key={crumb.label}>
          {index > 0 && <span>/</span>}
          <span
            className={
              crumb.isLink
                ? 'tw:text-[color:var(--fg-link)]'
                : 'tw:text-[color:var(--fg-secondary)]'
            }>
            {crumb.label}
          </span>
        </Fragment>
      ))}
    </div>
    <div className="tw:flex tw:items-center tw:gap-3">
      <img
        alt=""
        className="tw:rounded-lg"
        height={34}
        src={service.iconSrc}
        width={34}
      />
      <span className="tw:text-[22px] tw:font-semibold tw:text-[color:var(--fg-primary)] tw:tracking-[-0.01em]">
        {service.name}
      </span>
      <Badge color="gray" size="md" type="pill-color">
        {service.typeLabel}
      </Badge>
    </div>
  </div>
);

export default AgentsPageHeader;
