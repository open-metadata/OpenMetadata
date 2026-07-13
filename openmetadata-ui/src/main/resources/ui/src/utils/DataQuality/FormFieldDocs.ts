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

/**
 * The form documentation markdown files (e.g. `TestCaseForm.md`) that back the
 * classic doc panel are authored as `$$section ... ### <Heading> $(id="field")
 * ... $$` blocks. This extracts each block's body keyed by its field id so the
 * per-field "Form Hint" popover can render the same source instead of a
 * duplicated set of translation strings.
 */
const SECTION_REGEX =
  /\$\$section[\s\S]*?\$\(id="([^"]+)"\)\s*([\s\S]*?)\n\$\$/g;

export const parseFormFieldDocs = (
  markdown: string
): Record<string, string> => {
  const docs: Record<string, string> = {};
  const regex = new RegExp(SECTION_REGEX);
  let match: RegExpExecArray | null = regex.exec(markdown);

  while (match !== null) {
    docs[match[1]] = match[2].trim();
    match = regex.exec(markdown);
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
      return {};
    }
  })();
  cacheFormDocs(formName, docs);

  return docs;
};
