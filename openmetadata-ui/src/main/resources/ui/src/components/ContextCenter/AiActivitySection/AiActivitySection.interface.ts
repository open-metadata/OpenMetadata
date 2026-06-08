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

export type ActivityKind = 'memory' | 'article' | 'document';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  count: number;
  title: string;
  surface: string;
  who: string;
  when: string;
}

export interface AiActivitySectionProps {
  items: ActivityItem[];
  isLoading?: boolean;
}
