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
import { SupportedLocales } from '../i18next/LocalUtil.interface';

const SECTION_OPEN = '$$section';
const SECTION_CLOSE = '\n$$';
/**
 * Matches only the id marker, within one already-delimited block. Bounded on
 * both sides by literals and with no `.`-style run, so it cannot backtrack.
 */
const FIELD_ID = /\$\(id="([^"]+)"\)/;

/**
 * The form documentation markdown files (e.g. `TestCaseForm.md`) that back the
 * classic doc panel are authored as `$$section ... ### <Heading> $(id="field")
 * ... $$` blocks. This extracts each block's body keyed by its field id so the
 * per-field "Form Hint" popover can render the same source instead of a
 * duplicated set of translation strings.
 *
 * Split and scan rather than one expression over the whole file. Matching the
 * block in a single pattern needs two `[\s\S]*?` runs, and every `$$section`
 * that never completes sends both of them across the remainder of the document
 * looking for a close that is not there — quadratic in the number of openers.
 * Locating the delimiters by index is linear and says the same thing.
 */
export const parseFormFieldDocs = (
  markdown: string
): Record<string, string> => {
  const docs: Record<string, string> = {};

  for (const block of markdown.split(SECTION_OPEN).slice(1)) {
    const closeAt = block.indexOf(SECTION_CLOSE);
    // An unterminated block is dropped. This is the one place the behaviour
    // differs from the old pattern, and deliberately: `\n$$` also matches the
    // start of `\n$$section`, so the pattern closed a dangling block on the
    // *next* section's opener — emitting that block with a body that was never
    // its own, and consuming the following section so it never appeared at
    // all. Skipping the malformed block keeps the well-formed one. No shipped
    // doc has an unterminated block, so nothing in the product changes.
    if (closeAt === -1) {
      continue;
    }

    const body = block.slice(0, closeAt);
    const id = FIELD_ID.exec(body);

    if (id) {
      docs[id[1]] = body.slice(id.index + id[0].length).trim();
    }
  }

  return docs;
};

const DOCS_CACHE_MAX_SIZE = 50;

// Bounded cache of the in-flight fetch+parse promise per form. Caching the
// promise (not the resolved value) lets concurrent callers share one request,
// so the file is fetched at most once per form; the size cap keeps this
// module-level cache from growing without bound, per the repo's caching rule
// (the same bounded pattern used for the tag-data cache in TagSuggestion).
const docsCache = new Map<string, Promise<Record<string, string>>>();

const cacheFormDocs = (
  formName: string,
  docs: Promise<Record<string, string>>
): void => {
  docsCache.delete(formName);
  docsCache.set(formName, docs);
  while (docsCache.size > DOCS_CACHE_MAX_SIZE) {
    const oldestKey = docsCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    docsCache.delete(oldestKey);
  }
};

/**
 * Fetches and parses a form documentation markdown file into a
 * `{ fieldId: sectionMarkdown }` map. English-only (matching the classic doc
 * panel) and cached per form — concurrent callers share the same in-flight
 * request, so the file is fetched at most once per form.
 *
 * Successes are cached; failures are not. A fetch can fail for reasons that do
 * not outlive the request — a dev server restart, a deploy swapping assets
 * mid-flight, a dropped connection — and caching the empty result would pin
 * that transient miss for the lifetime of the page. The form then renders
 * hint-less with no way to recover short of a reload, which reads as "this
 * form has no docs" rather than "one fetch failed".
 */
export const loadFormFieldDocs = (
  formName: string
): Promise<Record<string, string>> => {
  const cached = docsCache.get(formName);
  if (cached) {
    return cached;
  }

  const docs = (async () => {
    try {
      const markdown = await fetchMarkdownFile(
        `${SupportedLocales.English}/OpenMetadata/${formName}.md`
      );

      return parseFormFieldDocs(markdown);
    } catch {
      // Runs after cacheFormDocs below (this await already suspended), so the
      // eviction lands on the entry that was stored, not ahead of it.
      docsCache.delete(formName);

      return {};
    }
  })();
  cacheFormDocs(formName, docs);

  return docs;
};
