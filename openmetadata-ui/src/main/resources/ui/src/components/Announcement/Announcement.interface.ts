/*
 *  Copyright 2024 Collate.
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
import { Operation } from 'fast-json-patch';
import { HTMLAttributes } from 'react';
import {
  AnnouncementDetails,
  CreateThread,
  ThreadType,
} from '../../generated/api/feed/createThread';
import { Post, Thread } from '../../generated/entity/feed/thread';
import { ThreadUpdatedFunc } from '../../interface/feed.interface';
import { ConfirmState } from '../ActivityFeed/ActivityFeedCard/ActivityFeedCard.interface';

export type ThreadUpdatedFunction = (
  threadId: string,
  postId: string,
  isThread: boolean,
  data: Operation[]
) => Promise<void>;

export interface AnnouncementThreadProp extends HTMLAttributes<HTMLDivElement> {
  threadLink: string;
  threadType?: ThreadType;
  open?: boolean;
  postFeedHandler: (value: string, id: string) => Promise<void>;
  createThread: (data: CreateThread) => Promise<void>;
  updateThreadHandler: ThreadUpdatedFunction;
  onCancel?: () => void;
  deletePostHandler?: (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => Promise<void>;
}

export interface AnnouncementThreadBodyProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<
      AnnouncementThreadProp,
      | 'threadLink'
      | 'updateThreadHandler'
      | 'postFeedHandler'
      | 'deletePostHandler'
    > {
  refetchThread: boolean;
  editPermission: boolean;
}

export interface AnnouncementThreadListProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<AnnouncementThreadProp, 'updateThreadHandler'> {
  editPermission: boolean;
  threads: Thread[];
  postFeed: (value: string, id: string) => Promise<void>;
  onConfirmation: (data: ConfirmState) => void;
}

export interface AnnouncementFeedCardProp {
  feed: Post;
  task: Thread;
  editPermission: boolean;
  onConfirmation: (data: ConfirmState) => void;
  updateThreadHandler: ThreadUpdatedFunction;
  postFeed: (value: string, id: string) => Promise<void>;
}

export interface AnnouncementFeedCardBodyProp
  extends HTMLAttributes<HTMLDivElement> {
  feed: Post;
  editPermission: boolean;
  entityLink?: string;
  isThread?: boolean;
  task: Thread;
  announcementDetails?: AnnouncementDetails;
  showRepliesButton?: boolean;
  isReplyThreadOpen?: boolean;
  onReply?: () => void;
  onConfirmation: (data: ConfirmState) => void;
  showReplyThread?: () => void;
  updateThreadHandler: ThreadUpdatedFunc;
}
