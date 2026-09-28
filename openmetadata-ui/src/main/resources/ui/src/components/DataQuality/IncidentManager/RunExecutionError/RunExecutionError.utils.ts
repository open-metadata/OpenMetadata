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

export type TracebackLineKind = 'header' | 'location' | 'code' | 'exception';

export interface TracebackLine {
  kind: TracebackLineKind;
  text: string;
}

const HEADER = /^Traceback \(most recent call last\):/;
const LOCATION = /^\s*File ".*", line \d+/;
// Python joins chained exceptions with a fixed sentence between their tracebacks.
const CHAIN_NOTICE =
  /^(The above exception was the direct cause|During handling of the above exception)/;
const INDENTED = /^\s/;

/**
 * Splits a Python traceback into lines tagged by role, so each role can take
 * its own colour: the header, the file locations (and the notices joining
 * chained exceptions), the source lines, and the exception lines. Python
 * indents everything but the header, the notices and the exception, so an
 * unindented line is an exception or the rest of its message.
 */
export const parseTraceback = (stackTrace: string): TracebackLine[] =>
  stackTrace
    .trimEnd()
    .split('\n')
    .map((text) => {
      if (HEADER.test(text)) {
        return { kind: 'header', text };
      }
      if (LOCATION.test(text) || CHAIN_NOTICE.test(text)) {
        return { kind: 'location', text };
      }

      return {
        kind: text.trim() && !INDENTED.test(text) ? 'exception' : 'code',
        text,
      };
    });
