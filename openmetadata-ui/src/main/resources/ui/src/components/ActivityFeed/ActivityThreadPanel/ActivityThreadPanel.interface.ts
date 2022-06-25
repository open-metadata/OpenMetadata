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

import { HTMLAttributes } from 'react';
import { CreateThread } from '../../../generated/api/feed/createThread';
import { Thread, ThreadType } from '../../../generated/entity/feed/thread';
import { ThreadUpdatedFunc } from '../../../interface/feed.interface';
import { ConfirmState } from '../ActivityFeedCard/ActivityFeedCard.interface';

export interface ActivityThreadPanelProp
  extends HTMLAttributes<HTMLDivElement> {
  threadLink: string;
  open?: boolean;
  postFeedHandler: (value: string, id: string) => void;
  createThread: (data: CreateThread) => void;
  updateThreadHandler: ThreadUpdatedFunc;
  onCancel?: () => void;
  deletePostHandler?: (threadId: string, postId: string) => void;
}

export interface ActivityThreadPanelBodyProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<
      ActivityThreadPanelProp,
      | 'threadLink'
      | 'updateThreadHandler'
      | 'postFeedHandler'
      | 'onCancel'
      | 'createThread'
      | 'deletePostHandler'
    > {
  threadType: ThreadType;
  showHeader?: boolean;
  onTabChange?: (key: string) => void;
}

export interface ActivityThreadListProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<ActivityThreadPanelProp, 'deletePostHandler' | 'updateThreadHandler'> {
  threads: Thread[];
  selectedThreadId: string;
  postFeed: (value: string) => void;
  onThreadIdSelect: (value: string) => void;
  onThreadSelect: (value: string) => void;
  onConfirmation?: (data: ConfirmState) => void;
}
export interface ActivityThreadProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<ActivityThreadPanelProp, 'deletePostHandler' | 'updateThreadHandler'> {
  selectedThread: Thread;
  postFeed: (value: string) => void;
  onConfirmation?: (data: ConfirmState) => void;
}
