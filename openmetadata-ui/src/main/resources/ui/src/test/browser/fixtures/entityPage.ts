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
import { worker } from '../msw';

/** What an entity details page edits: the stored entity plus every write it sent. */
export interface EntityServer<T> {
  /** The entity as the server holds it now, after every PATCH so far. */
  current: () => T;
  /** Each JSON-patch body the page sent, in order. */
  patches: Operation[][];
  votes: unknown[];
  followed: string[];
  unfollowed: string[];
}

/**
 * Serves one entity at `/api/v1/<endpoint>` the way the server does: GET by
 * name, PATCH applies the JSON patch and returns the updated entity, votes
 * and followers update it too. Tests assert on what the page sent
 * (`patches`) and on what it shows after the round trip.
 */
export const serveEntity = <T extends { id: string }>(
  endpoint: string,
  entity: T
): EntityServer<T> => {
  let stored = deepClone(entity) as T;
  const server: EntityServer<T> = {
    current: () => stored,
    patches: [],
    votes: [],
    followed: [],
    unfollowed: [],
  };
  const base = `/api/v1/${endpoint}`;

  worker.use(
    http.get(`${base}/name/:fqn`, () => HttpResponse.json(stored)),
    http.get(`${base}/:id`, () => HttpResponse.json(stored)),
    http.patch(`${base}/:id`, async ({ request }) => {
      const ops = (await request.json()) as Operation[];
      server.patches.push(ops);
      stored = applyPatch(deepClone(stored), ops).newDocument as T;

      return HttpResponse.json(stored);
    }),
    http.put(`${base}/:id/vote`, async ({ request }) => {
      server.votes.push(await request.json());

      return HttpResponse.json({ entity: stored });
    }),
    http.put(`${base}/:id/followers`, async ({ request }) => {
      server.followed.push(String(await request.json()));

      return HttpResponse.json({ changeDescription: {} });
    }),
    http.delete(`${base}/:id/followers/:userId`, ({ params }) => {
      server.unfollowed.push(String(params.userId));

      return HttpResponse.json({ changeDescription: {} });
    })
  );

  return server;
};
