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

/**
 * Owners and reviewers are asset fields too: a stage that asks one of them while also requiring it
 * may find it empty, and the task then goes to the admins until it is set.
 */
export const asksARequiredGroup = (
  assignees: string,
  fields: { field: string }[] = []
): boolean =>
  assignees !== 'candidates' && fields.some(({ field }) => field === assignees);
