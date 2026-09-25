/*
 *  Copyright 2025 Collate.
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
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../../enums/CustomizeDetailPage.enum';

export type WidgetKey = DetailPageWidgetKeys | GlossaryTermDetailPageWidgetKeys;

/**
 * Grid-layout widget ids are either an exact enum value
 * (`KnowledgePanel.Description`) or the enum value followed by a `-<n>`
 * duplicate-instance suffix (`KnowledgePanel.Following-1`). Match exact first,
 * then only accept a startsWith when the next character is `-`, so sibling
 * keys can never false-positive against each other (a raw `startsWith` on
 * `KnowledgePanel.Table` would swallow `KnowledgePanel.Tables`).
 */
export const resolveWidgetKey = <T extends string>(
  i: string,
  knownKeys: readonly T[]
): T | undefined => {
  const exact = knownKeys.find((key) => key === i);
  if (exact) {
    return exact;
  }

  return knownKeys.find((key) => i.startsWith(`${key}-`));
};
