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

import { isUndefined } from 'lodash';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { getReplyText } from '../../../../utils/FeedUtils';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import { FeedFooterProp } from '../ActivityFeedCard.interface';

const FeedCardFooter: FC<FeedFooterProp> = ({
  repliedUsers,
  replies,
  className,
  threadId,
  onThreadSelect,
  isFooterVisible,
}) => {
  const { t } = useTranslation();
  const repliesCount = isUndefined(replies) ? 0 : replies;

  return (
    <div className={className}>
      {!isUndefined(repliedUsers) &&
      !isUndefined(replies) &&
      isFooterVisible ? (
        <div className="tw-flex tw-group tw-items-center">
          {repliedUsers?.map((u, i) => (
            <ProfilePicture
              className="tw-mt-0.5 tw-mx-0.5"
              data-testid="replied-user"
              id=""
              key={i}
              name={u}
              profileImgClasses="tw-align-baseline"
              width="18"
            />
          ))}
          <span
            className="tw-ml-1 tw-text-info tw-text-xs tw-underline tw-self-center"
            data-testid="reply-count"
            onClick={() => onThreadSelect?.(threadId as string)}>
            {`${t('label.view')} ${getReplyText(repliesCount)}`}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default FeedCardFooter;
