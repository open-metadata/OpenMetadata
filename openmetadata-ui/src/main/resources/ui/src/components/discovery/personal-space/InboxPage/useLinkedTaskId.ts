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

import { useSearchParams } from 'react-router-dom';
import { INBOX_TASK_ID_PARAM } from '../personalSpace.constants';

/** The task a link into the inbox names (`?taskId=`), if any. */
export const useLinkedTaskId = (): string | undefined => {
  const [searchParams] = useSearchParams();

  return searchParams.get(INBOX_TASK_ID_PARAM) ?? undefined;
};
