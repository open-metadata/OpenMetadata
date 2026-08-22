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

import { ROUTES } from '../../../constants/constants';

/**
 * Route constants for the personal-space surfaces (Inbox / My Data). The
 * Inbox is a routed full page (Activity / Tasks feed) with two deep-linkable
 * sub-tabs; My Data reuses the same shell but derives its own tab from the
 * path. `MY_DATA` aliases the core `ROUTES.MY_DATA` so both mode trees agree
 * on a single path for the owned-data surface.
 */
export const PERSONAL_SPACE_ROUTES = {
  INBOX: '/inbox',
  INBOX_ACTIVITY: '/inbox/activity',
  INBOX_TASKS: '/inbox/tasks',
  MY_DATA: ROUTES.MY_DATA,
} as const;
