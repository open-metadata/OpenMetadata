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

export type TracebackLineKind =
  | 'header'
  | 'location'
  | 'code'
  | 'exception'
  | 'truncated';

export interface TracebackLine {
  kind: TracebackLineKind;
  text: string;
}

const HEADER = 'Traceback (most recent call last):';
// Python joins chained exceptions with one of these sentences between their tracebacks.
const CHAIN_NOTICES = [
  'The above exception was the direct cause',
  'During handling of the above exception',
];
const LOCATION = /^\s*File ".*", line \d+/;
// Ingestion caps a long trace from its start and marks the cut, as "... [truncated N characters]".
const TRUNCATION_MARKER = /^\.\.\. \[truncated \d+ characters\]$/;
const INDENTED = /^\s/;

const getLineKind = (text: string, afterCut: boolean): TracebackLineKind => {
  if (text.startsWith(HEADER)) {
    return 'header';
  }
  if (
    LOCATION.test(text) ||
    CHAIN_NOTICES.some((notice) => text.startsWith(notice))
  ) {
    return 'location';
  }
  // The line after the marker is a fragment cut mid-way, whatever it looks like.
  if (afterCut) {
    return 'code';
  }

  return text.trim() && !INDENTED.test(text) ? 'exception' : 'code';
};

/**
 * Splits a Python traceback into lines tagged by role, so each role can take
 * its own colour: the header, the file locations (and the notices joining
 * chained exceptions), the source lines, the exception lines, and ingestion's
 * truncation marker. Python indents everything but the header, the notices
 * and the exception, so an unindented line is an exception or the rest of its
 * message.
 */
export const parseTraceback = (stackTrace: string): TracebackLine[] => {
  const lines = stackTrace.trimEnd().split('\n');

  return lines.map((text, index) => {
    if (TRUNCATION_MARKER.test(text)) {
      return { kind: 'truncated', text };
    }

    const afterCut = index > 0 && TRUNCATION_MARKER.test(lines[index - 1]);

    return { kind: getLineKind(text, afterCut), text };
  });
};
