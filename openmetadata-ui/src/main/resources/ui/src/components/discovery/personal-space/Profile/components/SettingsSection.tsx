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
import FieldRow from './FieldRow';

interface ReadOnlyRowProps {
  title: string;
  description?: string;
  testId?: string;
  children: React.ReactNode;
}

export const ReadOnlyRow: React.FC<ReadOnlyRowProps> = ({
  title,
  description,
  testId,
  children,
}) => (
  <div className="tw:px-5 tw:py-4" data-testid={testId}>
    <FieldRow description={description} title={title}>
      {children}
    </FieldRow>
  </div>
);

interface SettingsSectionProps {
  title: string;
  testId?: string;
  children: React.ReactNode;
}

/**
 * A titled settings section: uppercase caption above one bordered card whose
 * rows are separated by dividers.
 */
const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  testId,
  children,
}) => (
  <Box data-testid={testId} direction="col" gap={3}>
    <Typography
      className="tw:px-1 tw:text-primary-900 tw:uppercase"
      size="text-xs"
      weight="medium">
      {title}
    </Typography>
    <Box
      className="tw:divide-y tw:divide-secondary tw:overflow-hidden tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary"
      direction="col">
      {children}
    </Box>
  </Box>
);

export default SettingsSection;
