/*
 *  Copyright 2023 Collate.
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
import { Box, Skeleton } from '@openmetadata/ui-core-components';

import { uniqueId } from 'lodash';
import { TitleBreadcrumbSkeletonProps } from '../Skeleton.interfaces';

const TitleBreadcrumbSkeleton = ({
  loading,
  children,
}: TitleBreadcrumbSkeletonProps) =>
  loading ? (
    <Box className="layout-row" wrap="wrap">
      {Array(3)
        .fill(null)
        .map(() => (
          <Box className="layout-column tw:block" key={uniqueId()}>
            <Skeleton className="m-r-xs m-b-xss" height={16} width={150} />
          </Box>
        ))}
    </Box>
  ) : (
    children
  );

export default TitleBreadcrumbSkeleton;
