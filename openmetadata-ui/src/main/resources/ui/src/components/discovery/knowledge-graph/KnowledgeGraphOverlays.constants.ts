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

/** Relationship rows the node inspector shows before "View all". */
export const PREVIEW_RELATIONSHIPS = 3;

/**
 * Most rows "View all" expands in the drawer. Past this the paged details
 * table takes over, so a 300-column table never renders 300 drawer rows.
 * ADR:2026-10-19-kg-inspector-expands-relationships-inline
 */
export const INLINE_RELATIONSHIPS = 40;
