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
import classNames from 'classnames';
import { observer } from 'mobx-react';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import AppState from '../../AppState';
import { REACTION_LIST } from '../../constants/reactions.constant';
import { ReactionOperation } from '../../enums/reactions.enum';
import useImage from '../../hooks/useImage';

const Emoji = ({ reaction, reactionList, onReactionSelect }) => {
  // get reaction object based on cureent reaction
  const reactionObject = useMemo(
    () => REACTION_LIST.find((value) => value.reaction === reaction),
    [reaction]
  );

  const { image } = useImage(`emojis/${reactionObject.reaction}.png`);

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  // check if current user has reacted with emoji
  const isReacted = reactionList.some(
    (reactionItem) => reactionItem.user.id === currentUser.id
  );

  const userList = reactionList.map((reactionItem) => reactionItem.user.name);

  const handleOnClick = () => {
    const operation = isReacted
      ? ReactionOperation.REMOVE
      : ReactionOperation.ADD;
    onReactionSelect(reactionObject.reaction, operation);
  };

  const popoverContent = (
    <p
      className="tw-w-44 tw-break-normal tw-m-0 tw-p-0"
      data-testid="popover-content">
      {`${userList.join(', ')}`}{' '}
      <span className="tw-font-semibold">{`reacted with ${reaction} emoji`}</span>
    </p>
  );

  return (
    <Popover content={popoverContent} trigger="hover" zIndex={9999}>
      <Button
        className={classNames('ant-btn-reaction tw-mr-1', {
          'ant-btn-isReacted': isReacted,
        })}
        data-testid="emoji-button"
        shape="round"
        onClick={handleOnClick}>
        <g-emoji
          alias={reactionObject.alias}
          className="d-flex"
          data-testid="emoji"
          fallback-src={image}>
          {reactionObject.emoji}
        </g-emoji>
        <span data-testid="emoji-count">{reactionList.length}</span>
      </Button>
    </Popover>
  );
};

Emoji.propTypes = {
  reactionList: PropTypes.arrayOf(
    PropTypes.shape({
      reactionType: PropTypes.string.isRequired,
      user: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string,
        displayName: PropTypes.string,
        type: PropTypes.string,
      }).isRequired,
    }).isRequired
  ).isRequired,
  reaction: PropTypes.string.isRequired,
  onReactionSelect: PropTypes.func.isRequired,
};

export default observer(Emoji);
