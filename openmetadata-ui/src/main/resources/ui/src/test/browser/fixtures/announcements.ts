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
import { applyPatch, deepClone, Operation } from 'fast-json-patch';
import { http, HttpResponse } from 'msw';
import { CreateAnnouncement } from '../../../generated/api/feed/createAnnouncement';
import {
  Announcement,
  AnnouncementStatus,
} from '../../../generated/entity/feed/announcement';
import { worker } from '../msw';

/** What the announcement pages wrote, and what the server holds after it. */
export interface AnnouncementServer {
  current: () => Announcement[];
  created: CreateAnnouncement[];
  patches: Operation[][];
  /** Each DELETE as `<id>?<query>`. */
  deletes: string[];
}

/** AnnouncementRepository derives the status from the window, not the stored row. */
const statusOf = ({ startTime, endTime }: Announcement) => {
  const now = Date.now();
  if (now < startTime) {
    return AnnouncementStatus.Scheduled;
  }

  return now > endTime ? AnnouncementStatus.Expired : AnnouncementStatus.Active;
};

/**
 * Serves `/api/v1/announcements` as the server does: list filtered by
 * `entityLink`, `active` and `status`; create, patch and delete by id.
 */
export const serveAnnouncements = (): AnnouncementServer => {
  let stored: Announcement[] = [];
  let next = 0;
  const server: AnnouncementServer = {
    current: () => stored,
    created: [],
    patches: [],
    deletes: [],
  };
  const withStatus = (a: Announcement) => ({ ...a, status: statusOf(a) });

  worker.use(
    http.get('/api/v1/announcements', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const status =
        params.get('active') === 'true'
          ? AnnouncementStatus.Active
          : params.get('status');
      const data = stored
        .map(withStatus)
        .filter(
          (a) =>
            (!params.has('entityLink') ||
              a.entityLink === params.get('entityLink')) &&
            (!status || a.status === status)
        );

      return HttpResponse.json({ data, paging: { total: data.length } });
    }),
    http.post('/api/v1/announcements', async ({ request }) => {
      const body = (await request.json()) as CreateAnnouncement;
      server.created.push(body);
      next += 1;
      const created = withStatus({
        ...body,
        id: `9f4a5b6c-0000-4000-8000-${String(next).padStart(12, '0')}`,
        name: `announcement_${next}`,
        owners: [],
      });
      stored = [...stored, created];

      return HttpResponse.json(created);
    }),
    http.patch('/api/v1/announcements/:id', async ({ params, request }) => {
      const ops = (await request.json()) as Operation[];
      server.patches.push(ops);
      stored = stored.map((a) =>
        a.id === params.id ? applyPatch(deepClone(a), ops).newDocument : a
      );

      return HttpResponse.json(stored.find((a) => a.id === params.id));
    }),
    http.delete('/api/v1/announcements/:id', ({ params, request }) => {
      server.deletes.push(`${params.id}${new URL(request.url).search}`);
      stored = stored.filter((a) => a.id !== params.id);

      return HttpResponse.json({});
    })
  );

  return server;
};
