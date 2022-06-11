/*
 *  Copyright 2021 Collate
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
import { groupBy, uniqueId } from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import {
  REACTION_LIST,
  REACTION_TYPE_LIST,
} from '../../constants/reactions.constant';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import Emoji from './Emoji';

const Reactions = ({ reactions }) => {
  // prepare reaction list for reaction popover
  const reactionList = REACTION_LIST.map((reaction) => (
    <Button
      aria-label={reaction.reaction}
      key={uniqueId()}
      size="small"
      title={reaction.reaction}
      type="text">
      <g-emoji
        alias={reaction.alias}
        className="d-flex"
        fallback-src={`../../assets/img/emojis/${reaction.reaction}.png`}>
        {reaction.emoji}
      </g-emoji>
    </Button>
  ));

  // prepare dictionary for each emojis and corresponding users list
  const modifiedReactionObject = groupBy(reactions, 'reactionType');

  const emojis = REACTION_TYPE_LIST.map((reaction) => {
    const reactionList = modifiedReactionObject[reaction];

    return (
      reactionList && (
        <Emoji
          key={uniqueId()}
          reaction={reaction}
          reactionList={reactionList}
        />
      )
    );
  });

  return (
    <div className="tw-ml-8 tw-mb-4">
      <div className="tw-flex">
        {emojis}
        <Popover content={reactionList} trigger="click">
          <Button shape="round">
            <SVGIcons
              alt="add-reaction"
              icon={Icons.ADD_REACTION}
              title="Add reactions"
            />
          </Button>
        </Popover>
      </div>
    </div>
  );
};

Reactions.propTypes = {
  reactions: PropTypes.arrayOf(
    PropTypes.shape({
      reactionType: PropTypes.string.isRequired,
      user: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string,
        displayName: PropTypes.string,
        type: PropTypes.string,
      }).isRequired,
    })
  ).isRequired,
};

export default Reactions;
