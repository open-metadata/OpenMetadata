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
  // First, temporarily replace entity links to protect them from encoding
  const entityLinkRegex = /<#E::[^>]+>/g;
  const entityLinks: string[] = [];
  let entityLinkIndex = 0;

  const protectedHtml = html.replace(entityLinkRegex, (match) => {
    entityLinks.push(match);

    return `__ENTITY_LINK_${entityLinkIndex++}__`;
  });

  // Sanitize the content with standard DOMPurify settings
  const sanitizedContent = DOMPurify.sanitize(protectedHtml);

  // Restore entity links
  let restoredContent = sanitizedContent;
  entityLinks.forEach((link, index) => {
    restoredContent = restoredContent.replace(`__ENTITY_LINK_${index}__`, link);
  });

  return restoredContent;
};
