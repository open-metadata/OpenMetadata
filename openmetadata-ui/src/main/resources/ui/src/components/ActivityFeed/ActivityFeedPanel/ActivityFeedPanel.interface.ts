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

import { EntityThread } from 'Models';
import { HTMLAttributes } from 'react';

export interface ActivityFeedPanelProp extends HTMLAttributes<HTMLDivElement> {
  selectedThread: EntityThread;
  open?: boolean;
  onCancel: () => void;
  postFeed: (value: string) => void;
  deletePostHandler?: (threadId: string, postId: string) => void;
}

export interface FeedPanelHeaderProp
  extends HTMLAttributes<HTMLHeadingElement>,
    Pick<ActivityFeedPanelProp, 'onCancel'> {
  entityField: string;
  noun?: string;
  onShowNewConversation?: (v: boolean) => void;
}
export interface FeedPanelOverlayProp
  extends HTMLAttributes<HTMLButtonElement>,
    Pick<ActivityFeedPanelProp, 'onCancel'> {}
export interface FeedPanelBodyProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<ActivityFeedPanelProp, 'deletePostHandler'> {
  threadData: EntityThread;
  isLoading: boolean;
}
