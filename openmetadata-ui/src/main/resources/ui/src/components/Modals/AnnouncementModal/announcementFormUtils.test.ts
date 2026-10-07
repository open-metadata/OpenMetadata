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

import { toPlainDescription } from './announcementFormUtils';

describe('toPlainDescription', () => {
  it('should unwrap the paragraph the block editor wrapped plain text in', () => {
    expect(toPlainDescription('<p>Scheduled downtime</p>')).toBe(
      'Scheduled downtime'
    );
    expect(toPlainDescription('  <p>Scheduled downtime</p>  ')).toBe(
      'Scheduled downtime'
    );
  });

  it('should unwrap a paragraph that carries attributes', () => {
    expect(toPlainDescription('<p dir="ltr">Scheduled downtime</p>')).toBe(
      'Scheduled downtime'
    );
  });

  it('should leave richer markup verbatim rather than flattening it', () => {
    // Stripping tags here would drop the link on an edit that only meant to
    // move the dates -- the markup is worse to look at but not destructive.
    const rich = '<p>See <a href="https://example.com">the runbook</a></p>';

    expect(toPlainDescription(rich)).toBe(rich);

    const list = '<ul><li>One</li><li>Two</li></ul>';

    expect(toPlainDescription(list)).toBe(list);
  });

  it('should leave text that was never wrapped alone', () => {
    expect(toPlainDescription('Scheduled downtime')).toBe('Scheduled downtime');
    expect(toPlainDescription('A **bold** note')).toBe('A **bold** note');
  });

  it('should read an empty editor as empty, so the required rule still bites', () => {
    expect(toPlainDescription('<p></p>')).toBe('');
    expect(toPlainDescription(undefined)).toBe('');
    expect(toPlainDescription('')).toBe('');
  });
});
