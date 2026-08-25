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

import { Divider } from 'antd';
import classNames from 'classnames';
import { FC } from 'react';
import { FeedListSeparatorProp } from '../ActivityFeedList/ActivityFeedList.interface';
import './feed-list-separator.less';

const FeedListSeparator: FC<FeedListSeparatorProp> = ({
  className,
  relativeDay,
}) => {
  return (
    <Divider
      className={classNames('feed-list-separator', className)}
      data-testid="separator">
      {relativeDay ? (
        <span data-testid="relative-day">{relativeDay}</span>
      ) : null}
    </Divider>
  );
};

export default FeedListSeparator;
