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
import { AnnouncementEntity } from '../../rest/announcementsAPI';
import { ConfirmState } from '../ActivityFeed/ActivityFeedCard/ActivityFeedCard.interface';

export type AnnouncementUpdatedFunction = (
  announcementId: string,
  data: Operation[]
) => Promise<void>;

export interface AnnouncementThreadProp extends HTMLAttributes<HTMLDivElement> {
  threadLink: string;
  open?: boolean;
  updateAnnouncementHandler: AnnouncementUpdatedFunction;
  onCancel?: () => void;
  deleteAnnouncementHandler?: (announcementId: string) => Promise<void>;
}

export interface AnnouncementThreadBodyProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<
      AnnouncementThreadProp,
      'threadLink' | 'updateAnnouncementHandler' | 'deleteAnnouncementHandler'
    > {
  refetchThread: boolean;
  editPermission: boolean;
}

export interface AnnouncementThreadListProp
  extends HTMLAttributes<HTMLDivElement> {
  editPermission: boolean;
  announcements: AnnouncementEntity[];
  onConfirmation: (data: ConfirmState) => void;
  updateAnnouncementHandler: AnnouncementUpdatedFunction;
}

export interface AnnouncementFeedCardProp {
  announcement: AnnouncementEntity;
  editPermission: boolean;
  onConfirmation: (data: ConfirmState) => void;
  updateAnnouncementHandler: AnnouncementUpdatedFunction;
}

export interface AnnouncementFeedCardBodyProp
  extends HTMLAttributes<HTMLDivElement> {
  announcement: AnnouncementEntity;
  editPermission: boolean;
  onConfirmation: (data: ConfirmState) => void;
  updateAnnouncementHandler: AnnouncementUpdatedFunction;
}
