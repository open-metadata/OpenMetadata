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
  ButtonUtility,
  Popover,
  PopoverTrigger,
} from '@openmetadata/ui-core-components';
import {
  FaceSmile,
  Reactions as AddReactionIcon,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { groupBy } from 'lodash';
import { FC, MouseEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  /**
   * What the tray marks as already picked; defaults to `reactions`. Lets a
   * reaction shown outside the pills (the Inbox's Like is the thumbs up) still
   * read as picked, and be taken back, in the tray.
   */
  pickedReactions?: ReactionProp[];
  variant?: ReactionsVariant;
  onReactionSelect: (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => void | Promise<void>;
}

const Reactions: FC<ReactionsProps> = ({
  reactions,
  pickedReactions = reactions,
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
    return pickedReactions.some(
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

  // The Inbox's pills drop the tray once every reaction is picked: there is
  // nothing left to add, and each pill takes its own back. The classic feed
  // keeps it, as the way it takes a reaction back.
  const canAddReaction =
    !isPill(variant) ||
    REACTION_LIST.some(({ reaction }) => !isReacted(reaction));

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

  const addReactionLabel = t('label.add-entity', {
    entity: t('label.reaction-lowercase-plural'),
  });

  return (
    <div
      className={classNames(
        'tw:inline-flex tw:items-center',
        isPill(variant) ? 'tw:gap-1.5' : 'tw:gap-2'
      )}
      data-testid="feed-reaction-container">
      {emojis}
      {canAddReaction && (
        <PopoverTrigger isOpen={visible} onOpenChange={setVisible}>
          {isPill(variant) ? (
            <Button
              aria-label={addReactionLabel}
              className="tw:h-6.5 tw:w-7 tw:rounded-full! tw:p-1! tw:*:data-icon:text-fg-secondary tw:hover:*:data-icon:text-fg-secondary_hover"
              color="tertiary"
              data-testid="add-reactions"
              iconLeading={<FaceSmile data-icon size={16} />}
              size="xs"
              title={addReactionLabel}
              onClick={(e: MouseEvent) => e.stopPropagation()}
            />
          ) : (
            <ButtonUtility
              aria-label={addReactionLabel}
              color="tertiary"
              data-testid="add-reactions"
              icon={AddReactionIcon}
              size="sm"
              title={addReactionLabel}
              onClick={(e: MouseEvent) => e.stopPropagation()}
            />
          )}
          <Popover
            arrow
            containerClassName="tw:flex tw:gap-2 tw:p-1"
            data-testid="feed-reactions-popover"
            placement="top start">
            {reactionList}
          </Popover>
        </PopoverTrigger>
      )}
    </div>
  );
};

export default Reactions;
