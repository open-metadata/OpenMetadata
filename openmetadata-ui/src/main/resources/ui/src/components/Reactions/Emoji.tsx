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

import '@github/g-emoji-element';
import { Button, Popover } from 'antd';
import classNames from 'classnames';
import { observer } from 'mobx-react';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppState from '../../AppState';
import { REACTION_LIST } from '../../constants/reactions.constant';
import { ReactionOperation } from '../../enums/reactions.enum';
import { Reaction, ReactionType } from '../../generated/type/reaction';
import useImage from '../../hooks/useImage';

interface EmojiProps {
  reaction: ReactionType;
  reactionList: Reaction[];
  onReactionSelect: (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => void;
}

const Emoji: FC<EmojiProps> = ({
  reaction,
  reactionList,
  onReactionSelect,
}) => {
  const { t } = useTranslation();
  const [reactionType, setReactionType] = useState(reaction);
  const [isClicked, setIsClicked] = useState(false);
  const [visible, setVisible] = useState(false);

  // get reaction object based on current reactionType
  const reactionObject = useMemo(
    () => REACTION_LIST.find((value) => value.reaction === reactionType),
    [reactionType]
  );

  const { image } = useImage(`emojis/${reactionObject?.reaction}.png`);

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  // check if current user has reacted with emoji
  const isReacted = reactionList.some(
    (reactionItem) => reactionItem.user.id === currentUser?.id
  );

  const reactedUserList = reactionList.map(
    (reactionItem) => reactionItem.user.name
  );

  const handleEmojiOnClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isClicked) {
      const operation = isReacted
        ? ReactionOperation.REMOVE
        : ReactionOperation.ADD;
      onReactionSelect(reactionObject?.reaction as ReactionType, operation);
      setIsClicked(true);
    }
  };

  const popoverContent = () => {
    const hasMore = reactedUserList.length > 8;
    const visibleList = reactedUserList.slice(0, 8);
    const moreList = reactedUserList.slice(8);

    return (
      <p
        className="tw-w-44 tw-break-normal tw-m-0 tw-p-0"
        data-testid="popover-content">
        {`${visibleList.join(', ')}`}
        {hasMore
          ? `, +${moreList.length} ${t('label.more-lowercase')}`
          : ''}{' '}
        <span className="tw-font-semibold">
          {t('message.reacted-with-emoji', { type: reactionType })}
        </span>
      </p>
    );
  };

  useEffect(() => {
    setReactionType(reaction);
    setIsClicked(false);
  }, [reaction]);

  return (
    <Popover
      content={popoverContent}
      key="reaction-detail-popover"
      open={visible}
      trigger="hover"
      zIndex={9999}
      onOpenChange={setVisible}>
      <Button
        className={classNames('ant-btn-reaction tw-mr-1 d-flex', {
          'ant-btn-isReacted': isReacted,
        })}
        data-testid="emoji-button"
        shape="round"
        onClick={handleEmojiOnClick}
        onMouseOver={() => setVisible(true)}>
        <div
          dangerouslySetInnerHTML={{
            __html: `<g-emoji
          alias={${reactionObject?.alias}}
          className="d-flex"
          data-testid="emoji"
          fallback-src={${image}}>
          ${reactionObject?.emoji}
        </g-emoji>`,
          }}
        />

        <span
          className="tw-text-sm tw-ml-1 self-center"
          data-testid="emoji-count">
          {reactionList.length}
        </span>
      </Button>
    </Popover>
  );
};

export default observer(Emoji);
