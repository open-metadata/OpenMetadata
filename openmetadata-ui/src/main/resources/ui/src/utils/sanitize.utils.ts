/*
 *  Copyright 2024 Collate.
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
import DOMPurify from 'dompurify';

export const getSanitizeContent = (html: string): string => {
  // Nonce makes placeholders unique per call, preventing collisions if the
  // user's text itself contains a placeholder-shaped string.
  const nonce = Math.random().toString(36).slice(2, 10);

  // Protect math equations from DOMPurify's unknown-tag stripping
  const mathEquationRegex =
    /<block-math-equation[^>]*>[\s\S]*?<\/block-math-equation>/g;
  const mathEquations: string[] = [];
  let mathEquationIndex = 0;

  const mathProtected = html.replaceAll(mathEquationRegex, (match) => {
    mathEquations.push(match);

    return `__OM_MATH_EQ_${nonce}_${mathEquationIndex++}__`;
  });

  // Protect entity links from DOMPurify encoding
  const entityLinkRegex = /<#E::[^>]+>/g;
  const entityLinks: string[] = [];
  let entityLinkIndex = 0;

  const protectedHtml = mathProtected.replaceAll(entityLinkRegex, (match) => {
    entityLinks.push(match);

    return `__OM_ENTITY_LINK_${nonce}_${entityLinkIndex++}__`;
  });

  const sanitizedContent = DOMPurify.sanitize(protectedHtml);

  // Restore entity links — use replacer fn so '$' in values is inserted verbatim
  let restoredContent = sanitizedContent;
  entityLinks.forEach((link, index) => {
    restoredContent = restoredContent.replace(
      `__OM_ENTITY_LINK_${nonce}_${index}__`,
      () => link
    );
  });

  mathEquations.forEach((eq, index) => {
    restoredContent = restoredContent.replace(
      `__OM_MATH_EQ_${nonce}_${index}__`,
      () => eq
    );
  });

  return restoredContent;
};
