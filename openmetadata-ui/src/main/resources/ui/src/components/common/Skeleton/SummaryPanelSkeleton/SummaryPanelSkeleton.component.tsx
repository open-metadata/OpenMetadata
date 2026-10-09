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
import { Box } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';

import { uniqueId } from 'lodash';
import { getSkeletonMockData } from '../../../../utils/Skeleton.utils';
import ButtonSkeleton from '../CommonSkeletons/ControlElements/ControlElements.component';
import LabelCountSkeleton from '../CommonSkeletons/LabelCountSkeleton/LabelCountSkeleton.component';
import { SkeletonInterface } from '../Skeleton.interfaces';

const SummaryPanelSkeleton = ({ loading, children }: SkeletonInterface) => {
  return loading ? (
    <div className="m-b-md p-md">
      <Box
        className="layout-row"
        justify="between"
        style={getLayoutGutter(32)}
        wrap="wrap">
        <Box
          className="layout-column tw:block m-t-md"
          style={{ maxWidth: '100%', flex: '0 0 100%' }}>
          {getSkeletonMockData(5).map(() => (
            <LabelCountSkeleton
              isCount
              isLabel
              firstColSize={8}
              key={uniqueId()}
              secondColSize={16}
              width={100}
            />
          ))}
        </Box>

        <Box
          className="layout-column tw:block m-l-xss"
          style={{ maxWidth: '100%', flex: '0 0 100%' }}>
          {getSkeletonMockData(10).map(() => (
            <ButtonSkeleton key={uniqueId()} size="large" />
          ))}
        </Box>
      </Box>
    </div>
  ) : (
    children
  );
};

export default SummaryPanelSkeleton;
