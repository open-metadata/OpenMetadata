/*
 *  Copyright 2025 Collate.
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
import classNames from 'classnames';

const REPLY_TEXT_LAYOUT = {
  // Held to the row's width: an editor holding a long unbroken word would
  // otherwise widen the reply past the card. The same small gap sits under
  // the name and under the message.
  body: 'tw:flex tw:w-full tw:min-w-0 tw:flex-col tw:gap-2',
  // A long name wraps, breaking inside an unbroken one, so the menu beside it
  // stays in the card.
  header: 'd-flex items-center gap-2 flex-wrap tw:min-w-0',
  name: 'tw:min-w-0 tw:wrap-anywhere',
};

// In the thread panels a reply reads compactly, as in the Inbox: no separator
// before the time and no rule between replies. Its avatar is the size of the
// message's and the comment input's.
export const getReplyLayout = (
  isThreadPanel?: boolean,
  isLastReply?: boolean
) =>
  isThreadPanel
    ? {
        root: 'd-flex items-start justify-start relative gap-3',
        avatar: 'tw:shrink-0 tw:pt-0.5',
        ...REPLY_TEXT_LAYOUT,
        avatarSize: 'sm' as const,
        showSeparator: false,
      }
    : {
        root: classNames(
          'd-flex items-start justify-start relative reply-card gap-2',
          { 'reply-card-border-bottom': !isLastReply }
        ),
        avatar: 'profile-picture',
        ...REPLY_TEXT_LAYOUT,
        avatarSize: 'sm' as const,
        showSeparator: true,
      };
