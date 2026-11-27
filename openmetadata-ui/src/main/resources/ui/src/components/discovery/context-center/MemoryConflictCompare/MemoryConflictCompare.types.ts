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
export type DiffChange = 'added' | 'removed';

export interface DiffSegment {
  /** Position in its side: a diff can repeat the same word. */
  id: string;
  value: string;
  change?: DiffChange;
}

/** One field of the two memories, as a split diff draws it. */
export interface DiffSides {
  current: DiffSegment[];
  proposed: DiffSegment[];
  isChanged: boolean;
}

export interface MemoryDiffRow {
  key: string;
  labelKey: string;
  /** Text reads as running words; a list as separate values. */
  kind: 'text' | 'list';
  sides: DiffSides;
}

/** A listed value, compared by what it is and shown by what it is called. */
export interface ListValue {
  key: string;
  label: string;
}

/** Why a side of the comparison could not be read. */
export type UnavailableMemory = 'gone' | 'hidden' | 'failed';

export interface KeepHint {
  key: string;
  options: Record<string, string | number>;
}
