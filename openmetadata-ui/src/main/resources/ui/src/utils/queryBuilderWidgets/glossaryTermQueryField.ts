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

/**
 * Marks a query-builder field as holding glossary terms so its rule renders the
 * shared tree picker. It lives on the field rather than being matched by path
 * because the JSONLogic builders reach glossary terms, classification tags and
 * tier through the same `tags.tagFQN` subfield.
 */
export const GLOSSARY_TERM_FIELD_MARKER = 'omGlossaryTermField';

type MarkedFieldSettings = Record<string, unknown>;

/** Adds the marker to a field's `fieldSettings`, keeping the rest untouched. */
export const withGlossaryTermField = <T extends MarkedFieldSettings>(
  fieldSettings: T
): T => ({ ...fieldSettings, [GLOSSARY_TERM_FIELD_MARKER]: true });

export const isGlossaryTermQueryField = (fieldDefinition: unknown): boolean =>
  Boolean(
    (fieldDefinition as { fieldSettings?: MarkedFieldSettings } | undefined)
      ?.fieldSettings?.[GLOSSARY_TERM_FIELD_MARKER]
  );
