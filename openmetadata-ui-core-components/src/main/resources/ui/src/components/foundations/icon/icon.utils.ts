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

// Matches URLs (http/https with content, absolute paths with content, data URIs),
// relative paths with image extensions, or bare filenames with image extensions.
// Filenames restricted to alphanumeric, hyphens, underscores, dots, and slashes.
const IMAGE_URL_PATTERN =
  /^(https?:\/\/.+|\/(?!.*\.\.)[^\s]+|data:image\/.+)|^(?!.*\.\.)[\w\-./]+\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i;

/**
 * Check if a string is a valid image URL
 * @param str - String to check
 * @returns true if the string is a valid image URL
 */
export const isImageUrl = (str: string): boolean => {
  return IMAGE_URL_PATTERN.test(str);
};

/**
 * Get the proper image source URL for tag/classification icons
 * Handles absolute URLs, data URIs, and relative paths
 */
export const getTagImageSrc = (iconURL: string): string => {
  if (!iconURL) {
    return '';
  }

  if (iconURL.startsWith('http') || iconURL.startsWith('data:image')) {
    return iconURL;
  }

  return `${window.location.origin}/${iconURL.replace(/^\/+/, '')}`;
};
