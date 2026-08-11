/*
 *  Copyright 2026 Collate.
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
import { PagingResponse } from 'Models';
import APIClient from './index';

const BASE_URL = '/announcements';

export interface AnnouncementEntity {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  entityLink?: string;
  startTime: number;
  endTime: number;
  status?: 'Active' | 'Expired' | 'Scheduled';
  createdBy?: string;
  updatedBy?: string;
  createdAt?: number;
  updatedAt?: number;
  href?: string;
  deleted?: boolean;
}

export interface CreateAnnouncementRequest {
  name?: string;
  displayName?: string;
  description: string;
  entityLink?: string;
  startTime: number;
  endTime: number;
}

export interface ListAnnouncementsParams {
  fields?: string;
  entityLink?: string;
  status?: AnnouncementEntity['status'];
  active?: boolean;
  limit?: number;
  before?: string;
  after?: string;
}

export const listAnnouncements = async (params?: ListAnnouncementsParams) => {
  const response = await APIClient.get<PagingResponse<AnnouncementEntity[]>>(
    BASE_URL,
    { params }
  );

  return response.data;
};

export const getActiveAnnouncements = async (entityLink?: string) => {
  return listAnnouncements({
    entityLink,
    active: true,
    limit: 100,
  });
};

export const createAnnouncement = async (data: CreateAnnouncementRequest) => {
  const response = await APIClient.post<AnnouncementEntity>(BASE_URL, data);

  return response.data;
};

export const patchAnnouncement = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<AnnouncementEntity>(
    `${BASE_URL}/${id}`,
    data,
    {
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    }
  );

  return response.data;
};

export const deleteAnnouncement = async (id: string, hardDelete = false) => {
  const response = await APIClient.delete(`${BASE_URL}/${id}`, {
    params: { hardDelete },
  });

  return response.data;
};
