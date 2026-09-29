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
import { Box, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { Fragment } from 'react';
import { formatDateTimeLong } from '../../../utils/date-time/DateTimeUtils';

interface DateTimeDisplayProps {
  timestamp?: number;
  /** `compact` renders the stamp at 12px / text-secondary for dense tables. */
  size?: 'default' | 'compact';
}

const DateTimeDisplay = ({
  timestamp,
  size = 'default',
}: DateTimeDisplayProps) => {
  const dateValue = formatDateTimeLong(timestamp, 'MMMM dd, yyyy,');
  const timeValue = formatDateTimeLong(timestamp, 'h:mm a');
  const utcValue = formatDateTimeLong(timestamp, "'(UTC'ZZ')'");
  const isCompact = size === 'compact';

  return timestamp ? (
    <Box className="tw:leading-4" direction="col">
      <Typography
        as="span"
        className={classNames({ 'tw:text-secondary': isCompact })}
        data-testid="schedule-primary-details"
        size={isCompact ? 'text-xs' : 'text-sm'}
        weight={isCompact ? 'regular' : 'medium'}>
        {dateValue}
      </Typography>
      <Box align="center" gap={1}>
        <Typography
          as="span"
          className={classNames({ 'tw:text-secondary': isCompact })}
          data-testid="schedule-primary-details"
          size="text-xs">
          {timeValue}
        </Typography>
        <Typography
          as="span"
          className={classNames({
            'tw:text-secondary': isCompact,
            'tw:text-tertiary': !isCompact,
          })}
          data-testid="schedule-secondary-details"
          size="text-xs">
          {utcValue}
        </Typography>
      </Box>
    </Box>
  ) : (
    <Fragment>--</Fragment>
  );
};

export default DateTimeDisplay;
