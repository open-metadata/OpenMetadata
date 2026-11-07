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
 * Tiny typed factories for list rows. Only the fields list pages read; add a
 * field when a page needs it, typed against the generated model.
 */
const pad = (i: number) => String(i).padStart(2, '0');

export const uid = (prefix: string, i: number) =>
  `${prefix}-0000-4000-8000-${String(i).padStart(12, '0')}`;

export const many = <T>(count: number, make: (i: number) => T): T[] =>
  Array.from({ length: count }, (_, i) => make(i + 1));

/** Every entity the server returns carries id, name and fullyQualifiedName. */
export const named = (kind: string, i: number, parentFqn?: string) => {
  const name = `pw_${kind}_${pad(i)}`;

  return {
    id: uid('00000000', i),
    name,
    fullyQualifiedName: parentFqn ? `${parentFqn}.${name}` : name,
    displayName: `PW ${kind} ${pad(i)}`,
  };
};
