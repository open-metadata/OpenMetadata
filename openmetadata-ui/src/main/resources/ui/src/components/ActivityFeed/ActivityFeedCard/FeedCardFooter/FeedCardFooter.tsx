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

import { Button, Divider } from 'antd';
import { isUndefined } from 'lodash';
import { FC } from 'react';
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
    <Divider className={className} orientation="left">
      {!isUndefined(repliedUsers) &&
      !isUndefined(replies) &&
      isFooterVisible ? (
        <Button
          className="d-flex  p-0 items-center"
          data-testid="reply-count"
          size="small"
          type="link"
          onClick={() => onThreadSelect?.(threadId as string)}>
          {repliedUsers?.map((u, i) => (
            <ProfilePicture
              avatarType="outlined"
              className="m-r-xss"
              data-testid="replied-user"
              key={i}
              name={u}
              width="18"
            />
          ))}
          {`${t('label.view')} ${getReplyText(repliesCount)}`}
        </Button>
      ) : null}
    </Divider>
  );
};

export default FeedCardFooter;
