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

import { LabelCountSkeletonProps } from '../../Skeleton.interfaces';

const LabelCountSkeleton = ({
  isSelect,
  isLabel,
  isCount,
  labelProps,
  selectProps,
  countProps,
  firstColSize = 20,
  secondColSize = 4,
  ...props
}: LabelCountSkeletonProps) => {
  return (
    <Box className="layout-row tw:mb-6" justify="between" wrap="wrap">
      {isSelect || isLabel ? (
        <Box
          className="layout-column tw:block"
          style={{
            maxWidth: `${(firstColSize / 24) * 100}%`,
            flex: `0 0 ${`${(firstColSize / 24) * 100}%`}`,
          }}>
          <div className="w-48 flex">
            {isSelect ? (
              <div>
                <Skeleton height={16} width={14} {...props} {...selectProps} />
              </div>
            ) : null}
            {isLabel ? (
              <div className="m-l-xs">
                <Skeleton height={16} width={100} {...props} {...labelProps} />
              </div>
            ) : null}
          </div>
        </Box>
      ) : null}
      <Box
        className="layout-column tw:block"
        style={{
          maxWidth: `${(secondColSize / 24) * 100}%`,
          flex: `0 0 ${`${(secondColSize / 24) * 100}%`}`,
        }}>
        {isCount ? (
          <Skeleton height={16} width={40} {...props} {...countProps} />
        ) : null}
      </Box>
    </Box>
  );
};

export default LabelCountSkeleton;
