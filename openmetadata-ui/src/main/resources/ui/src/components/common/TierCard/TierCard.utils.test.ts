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

import { splitTierDescription } from './TierCard.utils';

describe('splitTierDescription', () => {
  it('splits a seeded markdown description into summary and details', () => {
    const { summary, details } = splitTierDescription(
      '**Critical data**\n\n- Used in revenue dashboards'
    );

    expect(summary).toBe('Critical data');
    expect(details).toContain('Used in revenue dashboards');
  });

  it('reads editor HTML as text, dropping empty paragraphs', () => {
    expect(splitTierDescription('<p></p><p>Critical data</p><p></p>')).toEqual({
      summary: 'Critical data',
      details: '',
    });
  });

  it('keeps an image-only block in the details', () => {
    const { details } = splitTierDescription(
      'Summary\n\n![Diagram](https://example.com/diagram.png)'
    );

    expect(details).toContain('https://example.com/diagram.png');
  });

  it('keeps words around inline markup at the top level', () => {
    expect(
      splitTierDescription('Critical <strong>source</strong> dataset')
    ).toEqual({ summary: 'Critical source dataset', details: '' });
  });

  it('turns a line break into a space', () => {
    expect(
      splitTierDescription('<p>Critical<br>business data</p>').summary
    ).toBe('Critical business data');
  });
});
