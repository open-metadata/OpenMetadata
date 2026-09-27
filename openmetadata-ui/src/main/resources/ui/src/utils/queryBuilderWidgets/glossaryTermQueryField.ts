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

// On the field, not matched by path: glossary, tags and tier share `tags.tagFQN`.
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
