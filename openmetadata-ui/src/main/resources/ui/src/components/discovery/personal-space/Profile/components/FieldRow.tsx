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

interface FieldRowProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * The shared two-column field layout: title + description pinned on the left,
 * the value (or edit control) on the right. Used by both the read-only rows and
 * `InlineEditCard`, so editable and read-only fields align identically. It has
 * no padding of its own — the caller (a padded card or wrapper) provides it.
 */
const FieldRow: React.FC<FieldRowProps> = ({
  title,
  description,
  children,
}) => (
  <Box
    className="tw:grid tw:[grid-template-columns:minmax(220px,1fr)_2fr]"
    gap={8}>
    <Box className="tw:max-w-[320px] tw:gap-0.5" direction="col">
      <Typography
        className="tw:text-primary-900"
        size="text-sm"
        weight="medium">
        {title}
      </Typography>
      {description && (
        <Typography
          className="tw:text-secondary"
          size="text-xs"
          weight="regular">
          {description}
        </Typography>
      )}
    </Box>
    <Box
      align="start"
      className="tw:flex tw:w-full tw:min-w-0 tw:flex-col tw:items-end tw:self-center"
      direction="col">
      {children}
    </Box>
  </Box>
);

export default FieldRow;
