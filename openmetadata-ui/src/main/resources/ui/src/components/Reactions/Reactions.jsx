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
import { observer } from 'mobx-react';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import AppState from '../../AppState';
import {
  REACTION_LIST,
  REACTION_TYPE_LIST,
} from '../../constants/reactions.constant';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import Emoji from './Emoji';
import Reaction from './Reaction';

const Reactions = ({ reactions, onReactionSelect }) => {
  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  /**
   *
   * @param reactionType
   * @returns true if current user has reacted with {reactionType}
   */
  const isReacted = (reactionType) => {
    return reactions.some(
      (reactionItem) =>
        reactionItem.user.id === currentUser.id &&
        reactionType === reactionItem.reactionType
    );
  };

  // prepare reaction list for reaction popover
  const reactionList = REACTION_LIST.map((reaction) => {
    return (
      <Reaction
        isReacted={isReacted(reaction.reaction)}
        key={uniqueId()}
        reaction={reaction}
        onReactionSelect={onReactionSelect}
      />
    );
  });

  // prepare dictionary for each emojis and corresponding users list
  const modifiedReactionObject = groupBy(reactions, 'reactionType');

  // prepare reacted emoji list
  const emojis = REACTION_TYPE_LIST.map((reaction) => {
    const reactionList = modifiedReactionObject[reaction];

    return (
      reactionList && (
        <Emoji
          key={uniqueId()}
          reaction={reaction}
          reactionList={reactionList}
          onReactionSelect={onReactionSelect}
        />
      )
    );
  });

  return (
    <div className="tw-ml-8 tw-mb-4">
      <div className="tw-flex">
        {emojis}
        <Popover content={reactionList} trigger="click">
          <Button className="ant-btn-reaction" shape="round">
            <SVGIcons
              alt="add-reaction"
              icon={Icons.ADD_REACTION}
              title="Add reactions"
              width="16px"
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
  onReactionSelect: PropTypes.func.isRequired,
};

export default observer(Reactions);
