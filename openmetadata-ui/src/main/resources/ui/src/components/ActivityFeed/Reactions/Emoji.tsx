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
import { Button, HoverCard } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { createElement, FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REACTION_LIST } from '../../../constants/reactions.constant';
import {
  ReactionOperation,
  ReactionsVariant,
} from '../../../enums/reactions.enum';
import { Reaction, ReactionType } from '../../../generated/type/reaction';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useImage from '../../../hooks/useImage';
import { getEntityName } from '../../../utils/EntityNameUtils';

// How a chip is drawn in each variant: its shape, its colors once the viewer
// has reacted with it, its colors otherwise, and its count.
interface ChipClasses {
  shape: string;
  reacted: string;
  idle: string;
  count: string;
}

const CHIP_CLASSES: Record<ReactionsVariant, ChipClasses> = {
  [ReactionsVariant.Default]: {
    shape: 'tw:h-[22px] tw:rounded-md! tw:px-2! tw:py-0!',
    reacted: 'tw:text-brand-secondary tw:after:outline-brand',
    idle: 'tw:text-secondary',
    count: 'tw:ml-1 tw:text-xs',
  },
  [ReactionsVariant.Pill]: {
    shape:
      'tw:h-6.5 tw:rounded-full! tw:px-2! tw:py-0! tw:shadow-none tw:font-semibold tw:hover:after:outline-primary tw:[&_g-emoji]:text-sm',
    reacted:
      'tw:bg-utility-brand-50 tw:hover:bg-utility-brand-50 tw:text-utility-brand-700 tw:hover:text-utility-brand-700 tw:after:outline-utility-brand-300',
    idle: 'tw:bg-primary tw:text-tertiary tw:hover:text-tertiary tw:after:outline-secondary',
    // The chip wraps emoji and count in one text span, so its gap never
    // reaches between them.
    count: 'tw:ml-1.25 tw:text-xs',
  },
};

interface EmojiProps {
  reaction: ReactionType;
  reactionList: Reaction[];
  variant?: ReactionsVariant;
  onReactionSelect: (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => void | Promise<void>;
}

const Emoji: FC<EmojiProps> = ({
  reaction,
  reactionList,
  variant = ReactionsVariant.Default,
  onReactionSelect,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [isUpdating, setIsUpdating] = useState(false);

  const reactionObject = useMemo(
    () => REACTION_LIST.find((value) => value.reaction === reaction),
    [reaction]
  );

  const { image } = useImage(`emojis/${reactionObject?.reaction}`);

  // check if current user has reacted with emoji
  const isReacted = reactionList.some(
    (reactionItem) => reactionItem.user.id === currentUser?.id
  );

  const reactedUserList = reactionList.map((reactionItem) =>
    getEntityName(reactionItem.user)
  );

  const handleEmojiOnClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isUpdating) {
      setIsUpdating(true);
      const operation = isReacted
        ? ReactionOperation.REMOVE
        : ReactionOperation.ADD;
      try {
        await onReactionSelect(reaction, operation);
      } finally {
        setIsUpdating(false);
      }
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
          {t('message.reacted-with-emoji', { type: reaction })}
        </span>
      </p>
    );
  };

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
    <HoverCard
      className="tw:p-3"
      content={popoverContent()}
      key={reaction}
      placement="top">
      <Button
        className={classNames(
          'tw:gap-1',
          CHIP_CLASSES[variant].shape,
          isReacted ? CHIP_CLASSES[variant].reacted : CHIP_CLASSES[variant].idle
        )}
        color="secondary"
        data-testid="emoji-button"
        isDisabled={isUpdating}
        size="xs"
        onClick={handleEmojiOnClick}>
        {element}
        <span className={CHIP_CLASSES[variant].count} data-testid="emoji-count">
          {reactionList.length.toLocaleString('en-US', {
            useGrouping: false,
          })}
        </span>
      </Button>
    </HoverCard>
  );
};

export default Emoji;
