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
import { Skeleton } from '@openmetadata/ui-core-components';
import { getSkeletonMockData } from '../../../../utils/Skeleton.utils';
import { SkeletonInterface } from '../Skeleton.interfaces';

const GlossaryV1Skeleton = ({ loading, children }: SkeletonInterface) => {
  return loading ? (
    <div
      className="tw:mb-4 tw:flex tw:flex-col tw:gap-4 tw:p-4"
      data-testid="glossary-left-panel-skeleton">
      <Skeleton height={16} width="40%" />
      <Skeleton height={24} variant="rounded" />
      <Skeleton height={24} variant="rounded" />
      <div className="tw:flex tw:flex-col tw:gap-2">
        {getSkeletonMockData().map((key) => (
          <Skeleton height={24} key={key} variant="rounded" />
        ))}
      </div>
    </div>
  ) : (
    children
  );
};

export default GlossaryV1Skeleton;
