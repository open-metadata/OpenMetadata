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
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getFormattedDataAssetServiceType } from '../../../../../utils/DataAssetServiceUtils';
import serviceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';
import {
  BucketService,
  QuietHealthFilter,
} from '../../PlatformHealthWidget/useIngestionPipelineStats';
import { BUCKET_BADGE } from './BucketServiceRow.constants';
import { TOPIC_ROW_CLASSES } from './topicRowStyles';

export interface BucketServiceRowProps {
  service: BucketService;
  bucket: QuietHealthFilter;
  onOpen: (service: BucketService) => void;
}

/**
 * One healthy or not-yet-run service inside the Platform Health card. Laid out
 * like a failing row so switching buckets does not shift the list, with the
 * connector in place of the failure and the bucket in place of the pipeline.
 */
const BucketServiceRow: React.FC<BucketServiceRowProps> = ({
  service,
  bucket,
  onOpen,
}) => {
  const { t } = useTranslation();
  const badge = BUCKET_BADGE[bucket];

  return (
    <li>
      <button
        className={classNames(
          'tw:flex tw:w-[calc(100%+1rem)] tw:cursor-pointer tw:items-center tw:gap-3 tw:py-3 tw:text-left',
          TOPIC_ROW_CLASSES
        )}
        data-testid={`bucket-service-${service.id}`}
        type="button"
        onClick={() => onOpen(service)}>
        <img
          alt=""
          className="tw:size-8 tw:shrink-0 tw:rounded-md tw:object-contain"
          height={32}
          src={serviceUtilClassBase.getServiceLogo(service.serviceType)}
          width={32}
        />
        <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
          {/* `!` on the colours: Typography renders `.prose`, whose unlayered
          `color` rule is emitted after the Tailwind utilities and would
          otherwise silently win. */}
          <Typography
            className="tw:min-w-0 tw:text-text-primary!"
            ellipsis={{ rows: 1 }}
            size="text-xs"
            weight="medium">
            {service.displayName}
          </Typography>
          <Typography
            className="tw:min-w-0 tw:text-text-tertiary!"
            ellipsis={{ rows: 1 }}
            size="text-xs">
            {getFormattedDataAssetServiceType(service.serviceType)}
          </Typography>
        </span>
        <Badge
          className="tw:shrink-0"
          color={badge.color}
          size="sm"
          type="pill-color">
          {t(badge.labelKey)}
        </Badge>
      </button>
    </li>
  );
};

export default BucketServiceRow;
