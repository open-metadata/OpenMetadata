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

import { Typography } from '@openmetadata/ui-core-components';
import { InfoCircle } from '@untitledui/icons';
import React from 'react';

interface InfoLabelProps {
  text: string;
  description?: string;
  showIcon?: boolean;
  className?: string;
  onInfoClick?: () => void;
}

export const InfoLabel: React.FC<InfoLabelProps> = ({
  text,
  description,
  showIcon = true,
  className,
  onInfoClick,
}) => {
  return (
    <div className={className}>
      <div
        className={`tw:flex tw:items-center tw:gap-1 ${
          description ? 'tw:mb-1' : ''
        }`}>
        <Typography
          className="tw:text-secondary"
          size="text-sm"
          weight="medium">
          {text}
        </Typography>
        {showIcon && (
          <InfoCircle
            className={`tw:w-4 tw:h-4 tw:text-brand-600 ${
              onInfoClick ? 'tw:cursor-pointer' : ''
            }`}
            onClick={onInfoClick}
          />
        )}
      </div>
      {description && (
        <Typography className="tw:block tw:text-tertiary" size="text-xs">
          {description}
        </Typography>
      )}
    </div>
  );
};
