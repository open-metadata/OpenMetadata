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

import {
  CardStyle,
  FieldOperation,
  Thread,
} from '../../../../generated/entity/feed/thread';

export interface FeedCardHeaderV2Props {
  className?: string;
  isEntityFeed?: boolean;
  isAnnouncement?: boolean;
  about?: string;
  createdBy?: string;
  timeStamp?: number;
  fieldOperation?: FieldOperation;
  fieldName?: string;
  cardStyle?: CardStyle;
  feed: Thread;
  isAnnouncementTab?: boolean;
}
