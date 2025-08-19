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
import { Button } from 'antd';
import { Popover } from '../../common/AntdCompat';;
import classNames from 'classnames';
import { createElement, FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REACTION_LIST } from '../../../constants/reactions.constant';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { Reaction, ReactionType } from '../../../generated/type/reaction';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useImage from '../../../hooks/useImage';

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
  const { currentUser } = useApplicationStore();
  const [reactionType, setReactionType] = useState(reaction);
  const [isClicked, setIsClicked] = useState(false);
  const [visible, setVisible] = useState(false);

  // get reaction object based on current reactionType
  const reactionObject = useMemo(
    () => REACTION_LIST.find((value) => value.reaction === reactionType),
    [reactionType]
  );

  const { image } = useImage(`emojis/${reactionObject?.reaction}.png`);

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
      <p className="w-44 m-0 p-0" data-testid="popover-content">
        <span className="text-sm">{`${visibleList.join(', ')}`}</span>
        {hasMore
          ? `, +${moreList.length} ${t('label.more-lowercase')}`
          : ''}{' '}
        <span className="font-normal text-sm">
          {t('message.reacted-with-emoji', { type: reactionType })}
        </span>
      </p>
    );
  };

  useEffect(() => {
    setReactionType(reaction);
    setIsClicked(false);
  }, [reaction]);

  const element = createElement(
    'g-emoji',
    {
      alias: reactionObject?.alias,
      className: 'd-flex',
      'data-testid': 'emoji',
      'fallback-src': image,
    },
    reactionObject?.emoji
  );

  return (
    <Popover
      content={popoverContent}
      key={reaction}
      open={visible}
      trigger="hover"
      zIndex={9999}
      onOpenChange={setVisible}>
      <Button
        className={classNames(
          'ant-btn-reaction m-r-xss flex-center transparent',
          {
            'ant-btn-isReacted': isReacted,
          }
        )}
        data-testid="emoji-button"
        key={reaction}
        shape="round"
        size="small"
        onClick={handleEmojiOnClick}
        onMouseOver={() => setVisible(true)}>
        {element}
        <span className="text-xs m-l-xs self-center" data-testid="emoji-count">
          {reactionList.length.toLocaleString('en-US', {
            useGrouping: false,
          })}
        </span>
      </Button>
    </Popover>
  );
};

export default Emoji;
