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
 * Matches a parameter bullet in the form docs: a list item whose leading bold
 * is immediately followed by a type parenthetical. Both spellings occur:
 *
 *     - **Threshold** (NUMBER, Optional) - Number to compare against
 *     - **Min** (INT) - The minimum acceptable average value
 *     - **Longitude Column Name (X)** (STRING, Required) - Name of the column
 *
 * The type parenthetical is what makes this safe. The docs use the same
 * `- **lead-in**: prose` shape for descriptive bullets that are NOT parameters
 * ("- **Track quality trends**: Monitor how data quality varies..."), and
 * nothing about the name itself distinguishes the two — length does not: the
 * longest name in the docs is a real parameter and several short ones are
 * prose. Only parameter bullets carry the type.
 *
 * The trailing `[,)]` matters: an earlier version required a comma and silently
 * skipped the 20 `(INT)` parameters, leaving them bold amongst mono siblings.
 */
const PARAMETER_BULLET = /^(\s*[-*]\s+)\*\*([^*]+)\*\*(\s*\([A-Z]+[,)])/gm;

/**
 * Renders parameter NAMES as code so they pick up the hint panel's mono
 * styling, matching the design's parameter rows (mono name, prose description).
 * Descriptive bullets are deliberately left as bold prose.
 *
 * Applied at render time rather than in the markdown so the docs stay readable
 * as prose and the classic drawer's rendering is unaffected.
 */
export const monospaceParameterNames = (markdown: string): string =>
  markdown.replace(PARAMETER_BULLET, '$1`$2`$3');
