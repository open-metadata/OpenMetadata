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
import { fetchMarkdownFile } from '../../rest/miscAPI';
import { loadFormFieldDocs, parseFormFieldDocs } from './FormFieldDocs';

jest.mock('../../rest/miscAPI', () => ({
  __esModule: true,
  fetchMarkdownFile: jest.fn(),
}));

const mockFetchMarkdownFile = fetchMarkdownFile as jest.Mock;

// Mirrors the authored shape of TestCaseForm.md: `$$section` blocks whose
// heading carries a `$(id="...")` marker, at both ### (form field) and ####
// (test definition) levels.
const SAMPLE_MD = `# Data Quality

Intro paragraph that is not part of any section.

$$section
### Table $(id="table")

Select the table on which you want to create the test case.

For column-level tests, choose a column after the table.
$$

$$section
### Test Type $(id="testType")

Choose the type of test.
- Value validation
- Uniqueness checks
$$

## Column-Level Test Definitions

$$section
#### Column Values To Be Between $(id="columnValuesToBeBetween")

**Parameters**:
- **minValue** (INT)
- **maxValue** (INT)
$$
`;

describe('parseFormFieldDocs', () => {
  it('extracts each section keyed by its $(id) field id', () => {
    const docs = parseFormFieldDocs(SAMPLE_MD);

    expect(Object.keys(docs).sort()).toEqual([
      'columnValuesToBeBetween',
      'table',
      'testType',
    ]);
  });

  it('captures the full section body and trims surrounding whitespace', () => {
    const docs = parseFormFieldDocs(SAMPLE_MD);

    expect(docs.table).toBe(
      'Select the table on which you want to create the test case.\n\n' +
        'For column-level tests, choose a column after the table.'
    );
  });

  it('supports both ### and #### heading levels and keeps markdown', () => {
    const docs = parseFormFieldDocs(SAMPLE_MD);

    expect(docs.testType).toContain('- Value validation');
    expect(docs.columnValuesToBeBetween).toContain('**minValue** (INT)');
  });

  it('ignores content outside of $$section blocks', () => {
    const docs = parseFormFieldDocs(SAMPLE_MD);

    expect(JSON.stringify(docs)).not.toContain('Intro paragraph');
  });

  it('drops an unterminated block and keeps parsing the rest', () => {
    // The old pattern closed a dangling block on the next section's opener,
    // because `\n$$` matches the start of `\n$$section`. That emitted
    // `dangling` with a body that was not its own and swallowed `good`
    // entirely. Skipping the malformed block is the better answer, and
    // scanning by index — rather than one pattern over the whole file — is
    // also what keeps parsing linear.
    const docs = parseFormFieldDocs(
      [
        '$$section',
        '### Dangling $(id="dangling")',
        'Never closed.',
        '',
        '$$section',
        '### Good $(id="good")',
        'Closed properly.',
        '$$',
      ].join('\n')
    );

    expect(Object.keys(docs)).toEqual(['good']);
    expect(docs.good).toBe('Closed properly.');
  });

  it('returns an empty map when there are no sections', () => {
    expect(parseFormFieldDocs('# Heading only, no sections')).toEqual({});
    expect(parseFormFieldDocs('')).toEqual({});
  });
});

describe('loadFormFieldDocs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the English markdown for the form and parses it', async () => {
    mockFetchMarkdownFile.mockResolvedValueOnce(SAMPLE_MD);

    const docs = await loadFormFieldDocs('SampleFormA');

    expect(mockFetchMarkdownFile).toHaveBeenCalledWith(
      'en-US/OpenMetadata/SampleFormA.md'
    );
    expect(docs.table).toContain('Select the table');
    expect(docs.testType).toContain('Choose the type of test');
  });

  it('caches per form so the file is fetched at most once', async () => {
    mockFetchMarkdownFile.mockResolvedValue(SAMPLE_MD);

    const first = await loadFormFieldDocs('SampleFormB');
    const second = await loadFormFieldDocs('SampleFormB');

    expect(mockFetchMarkdownFile).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('dedupes concurrent calls for the same form via the in-flight promise', async () => {
    mockFetchMarkdownFile.mockResolvedValue(SAMPLE_MD);

    const [first, second] = await Promise.all([
      loadFormFieldDocs('SampleFormD'),
      loadFormFieldDocs('SampleFormD'),
    ]);

    expect(mockFetchMarkdownFile).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('falls back to an empty map when the fetch fails', async () => {
    mockFetchMarkdownFile.mockRejectedValueOnce(new Error('404 not found'));

    const docs = await loadFormFieldDocs('SampleFormC');

    expect(docs).toEqual({});
  });

  it('retries after a failure instead of caching the empty map', async () => {
    mockFetchMarkdownFile.mockRejectedValueOnce(new Error('404 not found'));
    mockFetchMarkdownFile.mockResolvedValueOnce(SAMPLE_MD);

    const failed = await loadFormFieldDocs('SampleFormE');
    const retried = await loadFormFieldDocs('SampleFormE');

    // Pinning the miss would leave the form permanently hint-less for the
    // lifetime of the page, with a reload as the only way back.
    expect(failed).toEqual({});
    expect(mockFetchMarkdownFile).toHaveBeenCalledTimes(2);
    expect(retried.table).toContain('Select the table');
  });
});
