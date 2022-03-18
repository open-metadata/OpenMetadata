/*
 *  Copyright 2021 Collate
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

import React, { FC } from 'react';
import { FeedListSeparatorProp } from './ActivityFeedList.interface';

const FeedListSeparator: FC<FeedListSeparatorProp> = ({
  className,
  relativeDay,
}) => {
  return (
    <div className={className}>
      <div className="tw-flex tw-justify-center">
        <hr
          className="tw-absolute tw-top-3 tw-border-b tw-border-main tw-w-full tw-z-0"
          data-testid="separator"
        />
        {relativeDay ? (
          <span
            className="tw-bg-white tw-px-4 tw-py-px tw-border tw-border-grey-muted tw-rounded tw-z-10 tw-text-grey-muted tw-font-medium"
            data-testid="relativeday">
            {relativeDay}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default FeedListSeparator;
