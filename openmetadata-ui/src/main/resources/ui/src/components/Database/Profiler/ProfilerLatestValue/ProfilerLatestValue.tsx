/*
 *  Copyright 2022 Collate.
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

import { Box, Divider, Grid, Typography, useTheme } from '@mui/material';
import { isUndefined } from 'lodash';
import { getStatisticsDisplayValue } from '../../../../utils/CommonUtils';
import '../ProfilerDashboard/profiler-dashboard.less';
import { ProfilerLatestValueProps } from '../ProfilerDashboard/profilerDashboard.interface';

const ProfilerLatestValue = ({
  information,
  tickFormatter,
  stringValue = false,
  extra,
}: ProfilerLatestValueProps) => {
  const theme = useTheme();

  const getLatestValue = (value?: number | string) => {
    if (isUndefined(value)) {
      return '--';
    }

    if (tickFormatter || stringValue) {
      return `${value}${tickFormatter ?? ''}`;
    } else {
      return getStatisticsDisplayValue(value);
    }
  };

  return (
    <Grid
      container
      alignItems="center"
      data-testid="data-summary-container"
      sx={{
        backgroundColor: theme.palette.grey[50],
        borderRadius: '10px',
        p: '16px 30px',
      }}>
      <Grid display="flex" gap={20} size="grow">
        {information.map((info) => (
          <Box key={info.title}>
            <Typography
              className="break-all"
              data-testid="title"
              sx={{
                color: theme.palette.grey[700],
                fontSize: theme.typography.pxToRem(11),
                fontWeight: 600,
                borderLeft: `4px solid ${info.color}`,
                paddingLeft: '8px',
                lineHeight: '12px',
                mb: 1,
              }}>
              {info.title}
            </Typography>
            <Typography
              className="break-all"
              data-testid="value"
              sx={{
                color: theme.palette.grey[900],
                fontSize: theme.typography.pxToRem(17),
                fontWeight: 700,
              }}>
              {getLatestValue(info.latestValue)}
            </Typography>
            {info.extra && (
              <>
                <Divider
                  sx={{
                    my: 2,
                    borderStyle: 'dashed',
                    borderColor: theme.palette.allShades.gray[300],
                  }}
                />
                <Typography
                  className="break-all"
                  data-testid="extra"
                  sx={{
                    color: theme.palette.grey[900],
                    fontSize: theme.typography.pxToRem(11),
                  }}>
                  {info.extra}
                </Typography>
              </>
            )}
          </Box>
        ))}
      </Grid>
      {extra && (
        <Grid display="flex" justifyContent="flex-end" size={1}>
          {extra}
        </Grid>
      )}
    </Grid>
  );
};

export default ProfilerLatestValue;
