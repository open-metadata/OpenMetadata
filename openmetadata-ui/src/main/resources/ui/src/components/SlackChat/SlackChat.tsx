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

import { faMessage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SlackChatConfig } from 'Models';
import React, { FC } from 'react';
import './SlackChat.css';

type Props = {
  slackConfig: SlackChatConfig;
};

const SlackChat: FC<Props> = ({ slackConfig }) => {
  const url = slackConfig.slackUrl;

  return url && url.length > 0 ? (
    <div className="slack-chat">
      <a href={url} rel="noreferrer" target="_blank">
        <div className="bubble">
          <div className="chatIcon">
            <FontAwesomeIcon icon={faMessage} size="2x" />
          </div>
        </div>
      </a>
    </div>
  ) : null;
};

export default SlackChat;
