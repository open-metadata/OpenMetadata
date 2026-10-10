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

import { Badge, Typography } from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getRelativeTime } from '../../../../../utils/date-time/DateTimeUtils';
import serviceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';
import {
  getFailingServiceReason,
  getPipelineTypeLabel,
} from '../../PlatformHealthWidget/PlatformHealthWidget.utils';
import { FailingService } from '../../PlatformHealthWidget/useIngestionPipelineStats';

export interface FailingServiceRowProps {
  service: FailingService;
  onOpen: (service: FailingService) => void;
}

/** One failing-service row inside the Platform Health topic card. */
const FailingServiceRow: React.FC<FailingServiceRowProps> = ({
  service,
  onOpen,
}) => {
  const { t } = useTranslation();

  return (
    <li>
      <button
        className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-3 tw:py-3 tw:text-left"
        data-testid={`failing-service-${service.id}`}
        type="button"
        onClick={() => onOpen(service)}>
        <img
          alt=""
          className="tw:size-8 tw:shrink-0 tw:rounded-md tw:object-contain"
          height={32}
          src={serviceUtilClassBase.getServiceLogo(service.serviceType)}
          width={32}
        />
        <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
          {/* `!` on the colours: Typography renders `.prose`, whose unlayered
          `color` rule is emitted after the Tailwind utilities and would
          otherwise silently win. */}
          <Typography
            className="tw:min-w-0 tw:text-text-primary!"
            ellipsis={{ rows: 1 }}
            size="text-sm"
            weight="medium">
            {service.displayName}
          </Typography>
          <Typography
            className="tw:min-w-0 tw:text-text-tertiary!"
            ellipsis={{ rows: 1 }}
            size="text-sm">
            {getFailingServiceReason(service, t)}
          </Typography>
        </span>
        {service.pipelineType && (
          <Badge
            className="tw:shrink-0"
            color="gray"
            size="sm"
            type="pill-color">
            {getPipelineTypeLabel(service.pipelineType, t)}
          </Badge>
        )}
        {service.lastRunTs && (
          <Typography
            className="tw:shrink-0 tw:text-text-tertiary!"
            size="text-sm">
            {getRelativeTime(service.lastRunTs)}
          </Typography>
        )}
      </button>
    </li>
  );
};

export default FailingServiceRow;
