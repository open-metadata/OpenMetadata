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
import {
  Box,
  Card,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import ProfilerLatestValue from '../ProfilerLatestValue/ProfilerLatestValue';
import { ProfilerStateWrapperProps } from './ProfilerStateWrapper.interface';

const ProfilerStateWrapper = ({
  isLoading,
  children,
  title,
  profilerLatestValueProps,
  dataTestId,
}: ProfilerStateWrapperProps) => {
  const theme = useTheme();

  if (isLoading) {
    return <Skeleton height={380} variant="rounded" width="100%" />;
  }

  return (
    <Box>
      {title && (
        <Typography
          sx={{
            fontSize: '16px',
            color: theme.palette.grey[900],
            fontWeight: 600,
            mb: 3,
          }}
          variant="h6">
          {title}
        </Typography>
      )}
      <Card
        data-testid={dataTestId ?? 'profiler-details-card-container'}
        sx={{
          p: 4,
          borderRadius: '10px',
          border: `1px solid ${theme.palette.grey[200]}`,
          boxShadow: 'none',
        }}>
        <Stack spacing={4}>
          {profilerLatestValueProps && (
            <ProfilerLatestValue {...profilerLatestValueProps} />
          )}
          <Box flexGrow={1}>{children}</Box>
        </Stack>
      </Card>
    </Box>
  );
};

export default ProfilerStateWrapper;
