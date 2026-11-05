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
import { Skeleton, SkeletonParagraph } from '@openmetadata/ui-core-components';

const KnowledgePageDetailSkeleton = () => {
  return (
    <div className="tw:h-full tw:overflow-y-auto">
      <div className="content-container m-b-md">
        <Skeleton
          className="rounded-4"
          height={40}
          variant="rounded"
          width="100%"
        />
        <SkeletonParagraph className="m-t-sm" rows={10} title={false} />
      </div>
    </div>
  );
};

export default KnowledgePageDetailSkeleton;
