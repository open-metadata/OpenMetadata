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

import { HTMLAttributes } from 'react';
import { Conversation } from '../../../generated/entity/feed/conversation';
import { ThreadUpdatedFunc } from '../../../interface/feed.interface';

export interface ActivityFeedPanelProp extends HTMLAttributes<HTMLDivElement> {
  selectedThread: Conversation;
  open?: boolean;
  onCancel: () => void;
  postFeed: (value: string) => void;
  deletePostHandler?: (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => void;
  updateThreadHandler: ThreadUpdatedFunc;
}

export interface FeedPanelHeaderProp
  extends HTMLAttributes<HTMLHeadingElement>,
    Pick<ActivityFeedPanelProp, 'onCancel'> {
  entityLink: string;
  noun?: string;
  onShowNewConversation?: (v: boolean) => void;
  hideCloseIcon?: boolean;
  feed?: Conversation;
}
