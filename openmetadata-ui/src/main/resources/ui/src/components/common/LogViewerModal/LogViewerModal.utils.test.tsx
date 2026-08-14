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
import { render, screen } from '@testing-library/react';
import { formatLogPart } from './LogViewerModal.utils';

describe('formatLogPart', () => {
  it('colours the timestamp, level, and logger of an OpenMetadata log line', () => {
    const line =
      '[2026-06-22 10:08:21] WARNING  {metadata.App:app:466} - Could not fetch events';

    render(<>{formatLogPart(line)}</>);

    const level = screen.getByText('WARNING');

    expect(level).toHaveClass('lvm-log-level', 'lvm-log-level--warn');
    expect(screen.getByText('[2026-06-22 10:08:21]')).toHaveClass('lvm-log-ts');
    expect(screen.getByText('{metadata.App:app:466}')).toHaveClass(
      'lvm-log-logger'
    );
    expect(screen.getByText(/Could not fetch events/)).toBeInTheDocument();
  });

  it('maps each known level to its severity bucket', () => {
    const cases: Array<[string, string]> = [
      ['INFO', 'lvm-log-level--info'],
      ['DEBUG', 'lvm-log-level--debug'],
      ['ERROR', 'lvm-log-level--error'],
      ['CRITICAL', 'lvm-log-level--error'],
    ];

    cases.forEach(([level, bucketClass]) => {
      const { unmount } = render(
        <>
          {formatLogPart(
            `[2026-06-22 10:08:21] ${level}     {x:y:1} - message`
          )}
        </>
      );

      expect(screen.getByText(level)).toHaveClass(bucketClass);

      unmount();
    });
  });

  it('returns non-log lines unchanged', () => {
    const pythonWarning = '  warnings.warn(message, FutureWarning)';
    const argoLine =
      'time="2026-06-25T04:33:09.746Z" level=info msg="capturing logs" argo=true';

    expect(formatLogPart(pythonWarning)).toBe(pythonWarning);
    expect(formatLogPart(argoLine)).toBe(argoLine);
  });

  it('does not colour an unrecognised level token', () => {
    const line = '[2026-06-22 10:08:21] NOTICE   {x:y:1} - message';

    expect(formatLogPart(line)).toBe(line);
  });
});
