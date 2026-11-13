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
import { Box, Typography } from '@openmetadata/ui-core-components';
import React from 'react';

export interface DqSectionCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Figma section shell for the Data Quality dashboard — a borderless titled
 * group (heading + subtitle + widgets). The inner widget cards carry their own
 * borders, matching the mock (no outer card-in-card border). Carries
 * `export-pdf-container` so the page-level PDF export captures each section.
 */
export const DqSectionCard: React.FC<DqSectionCardProps> = ({
  title,
  subtitle,
  children,
  className,
}) => {
  return (
    <div className={`export-pdf-container ${className ?? ''}`}>
      <Box className="tw:mb-5" direction="col" gap={1}>
        <Typography size="text-md" weight="semibold">
          {title}
        </Typography>
        {subtitle && (
          <Typography className="tw:text-tertiary" size="text-sm">
            {subtitle}
          </Typography>
        )}
      </Box>
      {children}
    </div>
  );
};

export default DqSectionCard;
