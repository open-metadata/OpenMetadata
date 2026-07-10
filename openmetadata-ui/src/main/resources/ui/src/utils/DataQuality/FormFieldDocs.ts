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
const SECTION_REGEX = /\$\$section[\s\S]*?\$\(id="([^"]+)"\)\s*([\s\S]*?)\n\$\$/g;

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

const docsCache = new Map<string, Record<string, string>>();

/**
 * Fetches and parses a form documentation markdown file into a
 * `{ fieldId: sectionMarkdown }` map. English-only (matching the classic doc
 * panel), cached per form so the file is fetched at most once.
 */
export const loadFormFieldDocs = async (
  formName: string
): Promise<Record<string, string>> => {
  const cached = docsCache.get(formName);
  if (cached) {
    return cached;
  }

  let docs: Record<string, string> = {};
  try {
    const markdown = await fetchMarkdownFile(
      `${SupportedLocales.English}/OpenMetadata/${formName}.md`
    );
    docs = parseFormFieldDocs(markdown);
  } catch {
    docs = {};
  }
  docsCache.set(formName, docs);

  return docs;
};
