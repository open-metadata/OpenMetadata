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

export type TypeMismatch =
  | { kind: 'expected-string'; got: string }
  | { kind: 'expected-boolean'; got: string }
  | { kind: 'expected-number'; got: string }
  | { kind: 'expected-string-array' }
  | { kind: 'expected-object-array' };

export type ValidationError =
  | { code: 'invalid-json'; error: string }
  | { code: 'top-level-must-be-object' }
  | { code: 'unknown-top-level-field'; field: string }
  | { code: 'entries-must-be-array' }
  | { code: 'entry-must-be-object'; index: number }
  | {
      code: 'entry-unknown-field';
      index: number;
      field: string;
      suggestion?: string;
    }
  | { code: 'entry-required-field'; index: number; field: string }
  | {
      code: 'entry-type-error';
      index: number;
      field: string;
      mismatch: TypeMismatch;
    }
  | {
      code: 'partition-column-must-be-object';
      entryIndex: number;
      colIndex: number;
    }
  | {
      code: 'partition-column-unknown-field';
      entryIndex: number;
      colIndex: number;
      field: string;
      suggestion?: string;
    }
  | {
      code: 'partition-column-required';
      entryIndex: number;
      colIndex: number;
      field: string;
    };

export type ValidationState =
  | { status: 'ok'; entryCount: number }
  | { status: 'empty' }
  | { status: 'error'; error: ValidationError };
