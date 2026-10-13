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
import {
  Button,
  Popover,
  PopoverTrigger,
} from '@openmetadata/ui-core-components';
import { FaceSmile } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { groupBy } from 'lodash';
import { FC, MouseEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddReactionIcon } from '../../../assets/svg/ic-add-emoji.svg';
import {
  REACTION_LIST,
  REACTION_TYPE_LIST,
} from '../../../constants/reactions.constant';
import {
  ReactionOperation,
  ReactionsVariant,
} from '../../../enums/reactions.enum';
import {
  Reaction as ReactionProp,
  ReactionType,
} from '../../../generated/type/reaction';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import Emoji from './Emoji';
import Reaction from './Reaction';

const isPill = (variant: ReactionsVariant) => variant === ReactionsVariant.Pill;

interface ReactionsProps {
  reactions: ReactionProp[];
  variant?: ReactionsVariant;
  onReactionSelect: (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => void | Promise<void>;
}

const Reactions: FC<ReactionsProps> = ({
  reactions,
  variant = ReactionsVariant.Default,
  onReactionSelect,
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const { currentUser } = useApplicationStore();

  const hide = () => {
    setVisible(false);
  };

  /**
   *
   * @param reactionType
   * @returns true if current user has reacted with {reactionType}
   */
  const isReacted = (reactionType: ReactionType) => {
    return reactions.some(
      (reactionItem) =>
        reactionItem.user.id === currentUser?.id &&
        reactionType === reactionItem.reactionType
    );
  };

  // prepare reaction list for reaction popover
  const reactionList = REACTION_LIST.map((reaction) => {
    return (
      <Reaction
        isReacted={isReacted(reaction.reaction)}
        key={reaction.reaction}
        reaction={reaction}
        onHide={hide}
        onReactionSelect={onReactionSelect}
      />
    );
  });

  // prepare dictionary for each emojis and corresponding users list
  const modifiedReactionObject = groupBy(reactions, 'reactionType');

  // prepare reacted emoji list
  const emojis = REACTION_TYPE_LIST.map((reaction) => {
    const reactionListValue = modifiedReactionObject[reaction];

    return (
      reactionListValue && (
        <Emoji
          key={reaction}
          reaction={reaction}
          reactionList={reactionListValue}
          variant={variant}
          onReactionSelect={onReactionSelect}
        />
      )
    );
  });

  return (
    <div
      className={classNames(
        'tw:inline-flex tw:items-center',
        isPill(variant) ? 'tw:gap-1.5' : 'tw:gap-2'
      )}
      data-testid="feed-reaction-container">
      {emojis}
      <PopoverTrigger isOpen={visible} onOpenChange={setVisible}>
        <Button
          aria-label={t('label.add-entity', {
            entity: t('label.reaction-lowercase-plural'),
          })}
          className={
            isPill(variant)
              ? 'tw:h-6.5 tw:w-7 tw:rounded-full! tw:p-1! tw:*:data-icon:text-fg-secondary tw:hover:*:data-icon:text-fg-secondary_hover'
              : 'tw:size-[22px] tw:rounded-md! tw:p-[3px]!'
          }
          color="tertiary"
          data-testid="add-reactions"
          iconLeading={
            isPill(variant) ? (
              <FaceSmile data-icon size={16} />
            ) : (
              <AddReactionIcon data-icon height={16} width={16} />
            )
          }
          size="xs"
          title={t('label.add-entity', {
            entity: t('label.reaction-lowercase-plural'),
          })}
          onClick={(e: MouseEvent) => e.stopPropagation()}
        />
        <Popover
          arrow
          containerClassName="tw:flex tw:gap-2 tw:p-1"
          data-testid="feed-reactions-popover"
          placement="top start">
          {reactionList}
        </Popover>
      </PopoverTrigger>
    </div>
  );
};

export default Reactions;
