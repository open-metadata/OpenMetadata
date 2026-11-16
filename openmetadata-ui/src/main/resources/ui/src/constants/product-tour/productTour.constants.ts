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

export const PRODUCT_TOUR_STORAGE_KEY = 'omProductTour';

export const REQUIRED_STABLE_LAYOUT_FRAMES = 3;
export const TARGET_WAIT_TIMEOUT_MS = 8000;

// Query parameters whose value changes on every visit (time windows, cache
// busters), so a recorded fixture still matches the request the page sends.
export const TOUR_VOLATILE_QUERY_PARAMS = [
  'start',
  'end',
  'startTs',
  'endTs',
  'timestamp',
  '_',
] as const;

// Requests the app shell makes for the signed-in user, which the tour leaves
// to the server: who is signed in, what they may do, how the app is set up.
// Everything a tour page shows comes from its fixtures instead.
export const TOUR_PASS_THROUGH_PATHS = [
  /^\/auth\//,
  /^\/saml\//,
  /^\/users\/(login|logout|refresh)\b/,
  /^\/users\/loggedInUser/,
  /^\/users\/name\/[^/]+\/?$/,
  // A user by id, and what hangs off them (their follows, preferences): only
  // the signed-in user is read this way, and the id differs per instance, so
  // a recorded one would never match anyway.
  /^\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/,
  /^\/permissions/,
  /^\/system\//,
  /^\/apps\/installed/,
  /^\/feed\/count/,
  /^\/docStore/,
  /^\/limits/,
  /^\/analytics\/web/,
] as const;

// Epoch-millisecond timestamps, which a request can also carry inside a query
// value or its body (a dashboard's time window inside a search filter).
export const TOUR_VOLATILE_TIMESTAMP_PATTERN = /\b1\d{12}\b/g;

// Updates and deletes; the tour drops them.
// POST also reads (searches, aggregations, report batches), so it is not one.
export const TOUR_WRITE_METHODS = ['put', 'patch', 'delete'] as const;
