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
import { Box, Card, Skeleton } from '@openmetadata/ui-core-components';
import ProfilerLatestValue from '../ProfilerLatestValue/ProfilerLatestValue';
import { ProfilerStateWrapperProps } from './ProfilerStateWrapper.interface';

const ProfilerStateWrapper = ({
  isLoading,
  children,
  title,
  profilerLatestValueProps,
  dataTestId,
}: ProfilerStateWrapperProps) => {
  if (isLoading) {
    return <Skeleton height={380} variant="rounded" width="100%" />;
  }

  return (
    <Box direction="col" gap={3}>
      {title && (
        <p
          className="tw:m-0 tw:text-md tw:font-semibold tw:text-primary"
          data-testid={`${title}-title`}>
          {title}
        </p>
      )}
      {/* overflow-visible: chart tooltips near the edge must not be clipped. */}
      <Card
        className="tw:overflow-visible"
        data-testid={dataTestId ?? 'profiler-details-card-container'}>
        <Card.Content>
          <Box direction="col" gap={4}>
            {profilerLatestValueProps && (
              <ProfilerLatestValue {...profilerLatestValueProps} />
            )}
            <div className="tw:grow">{children}</div>
          </Box>
        </Card.Content>
      </Card>
    </Box>
  );
};

export default ProfilerStateWrapper;
