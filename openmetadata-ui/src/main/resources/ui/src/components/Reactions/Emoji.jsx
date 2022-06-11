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
import { Button } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';
import { REACTION_LIST } from '../../constants/reactions.constant';

const Emoji = ({ reaction }) => {
  const reactionValue = REACTION_LIST.find(
    (value) => value.reaction === reaction.reactionType
  );

  return (
    <Button className="tw-mr-1" shape="round">
      <g-emoji
        alias={reactionValue.alias}
        className="d-flex"
        fallback-src={`../../assets/img/emojis/${reactionValue.reaction}.png`}>
        {reactionValue.emoji}
      </g-emoji>
    </Button>
  );
};

Emoji.propTypes = {
  reaction: PropTypes.shape({
    reactionType: PropTypes.string.isRequired,
    user: PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      displayName: PropTypes.string,
      type: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

export default Emoji;
