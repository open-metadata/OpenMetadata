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
import { ALERT_AI_FORM_CLASS_NAMES } from './AlertAiFormFields.constants';
import { AlertAiSectionProps } from './AlertAiFormFields.interface';

/** Provides the shared title, description, and spacing wrapper for AI alert form sections. */
const AlertAiSection = ({
  children,
  description,
  isRequired,
  title,
}: AlertAiSectionProps) => (
  <Box
    className={ALERT_AI_FORM_CLASS_NAMES.sectionRoot}
    data-testid={`${title.toLowerCase().replaceAll(' ', '-')}-section`}
    direction="col">
    <Box className={ALERT_AI_FORM_CLASS_NAMES.sectionHeader} direction="col">
      <Typography
        className="tw:flex tw:items-center tw:text-secondary"
        size="text-sm"
        weight="medium">
        {title}
        {isRequired && (
          <Typography
            as="span"
            className={ALERT_AI_FORM_CLASS_NAMES.sectionRequiredMarker}>
            *
          </Typography>
        )}
      </Typography>
      {description && (
        <Typography className="tw:text-secondary" size="text-xs">
          {description}
        </Typography>
      )}
    </Box>
    {children}
  </Box>
);

export default AlertAiSection;
