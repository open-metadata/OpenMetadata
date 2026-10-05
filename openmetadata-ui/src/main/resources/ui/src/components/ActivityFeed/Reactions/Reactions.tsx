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
  ButtonUtility,
  Popover,
  PopoverTrigger,
} from '@openmetadata/ui-core-components';
import { groupBy } from 'lodash';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddReactionIcon } from '../../../assets/svg/ic-add-emoji.svg';
import {
  REACTION_LIST,
  REACTION_TYPE_LIST,
} from '../../../constants/reactions.constant';
import { ReactionOperation } from '../../../enums/reactions.enum';
import {
  Reaction as ReactionProp,
  ReactionType,
} from '../../../generated/type/reaction';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import Emoji from './Emoji';
import Reaction from './Reaction';
import './reactions.less';

interface ReactionsProps {
  reactions: ReactionProp[];
  onReactionSelect: (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => void | Promise<void>;
}

const Reactions: FC<ReactionsProps> = ({ reactions, onReactionSelect }) => {
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
          onReactionSelect={onReactionSelect}
        />
      )
    );
  });

  return (
    <div className="d-flex items-center" data-testid="feed-reaction-container">
      {emojis}
      <PopoverTrigger isOpen={visible} onOpenChange={setVisible}>
        <ButtonUtility
          color="tertiary"
          data-testid="add-reactions"
          icon={<AddReactionIcon height={16} width={16} />}
          size="xs"
          tooltip={t('label.add-entity', {
            entity: t('label.reaction-lowercase-plural'),
          })}
        />
        <Popover arrow className="feed-reactions-popover" placement="top start">
          <div
            className="tw:flex tw:gap-2 tw:p-1"
            data-testid="feed-reactions-popover">
            {reactionList}
          </div>
        </Popover>
      </PopoverTrigger>
    </div>
  );
};

export default Reactions;
