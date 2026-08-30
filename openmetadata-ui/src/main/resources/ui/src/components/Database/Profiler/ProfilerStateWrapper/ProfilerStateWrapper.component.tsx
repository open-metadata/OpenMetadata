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
import { Skeleton } from '@openmetadata/ui-core-components';
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
    <div>
      {title && (
        <p
          className="tw:m-0 tw:mb-3 tw:text-md tw:font-semibold tw:text-primary"
          data-testid={`${title}-title`}>
          {title}
        </p>
      )}
      <div
        className="tw:rounded-[10px] tw:border tw:border-border-secondary tw:p-4 tw:shadow-none"
        data-testid={dataTestId ?? 'profiler-details-card-container'}>
        <div className="tw:flex tw:flex-col tw:gap-4">
          {profilerLatestValueProps && (
            <ProfilerLatestValue {...profilerLatestValueProps} />
          )}
          <div className="tw:grow">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default ProfilerStateWrapper;
