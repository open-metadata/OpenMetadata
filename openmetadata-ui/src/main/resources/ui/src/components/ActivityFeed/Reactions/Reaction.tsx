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
import classNames from 'classnames';
import { uniqueId } from 'lodash';
import { createElement, FC } from 'react';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { ReactionType } from '../../../generated/type/reaction';
import useImage from '../../../hooks/useImage';

interface ReactionProps {
  reaction: {
    emoji: string;
    reaction: ReactionType;
    alias: string;
  };
  isReacted: boolean;
  onReactionSelect: (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => void;
  onHide: () => void;
}

const Reaction: FC<ReactionProps> = ({
  reaction,
  isReacted,
  onReactionSelect,
  onHide,
}) => {
  const { image } = useImage(`emojis/${reaction.reaction}.png`);

  const handleOnClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const operation = isReacted
      ? ReactionOperation.REMOVE
      : ReactionOperation.ADD;
    onReactionSelect(reaction.reaction, operation);
    onHide();
  };

  const element = createElement(
    'g-emoji',
    {
      alias: reaction?.alias,
      className: 'd-flex',
      'data-testid': 'emoji',
      'fallback-src': image,
    },
    reaction?.emoji
  );

  return (
    <Button
      aria-label={reaction.reaction}
      className={classNames('ant-btn-popover-reaction', {
        'ant-btn-popover-isReacted': isReacted,
      })}
      data-testid="reaction-button"
      key={uniqueId()}
      size="small"
      title={reaction.reaction}
      type="text"
      onClick={handleOnClick}>
      {element}
    </Button>
  );
};

export default Reaction;
