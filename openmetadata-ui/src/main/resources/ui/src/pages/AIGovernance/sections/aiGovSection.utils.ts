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

export const AVATAR_PALETTE = [
  '#1570EF',
  '#7A5AF8',
  '#079455',
  '#B54708',
  '#175CD3',
];

export const initialOf = (text: string): string =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0])
    .join('')
    .toUpperCase() || '?';

export const colorFor = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }

  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

export const formatAge = (timestamp?: number): string => {
  if (!timestamp) {
    return '—';
  }
  const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (days <= 0) {
    return 'today';
  }
  if (days === 1) {
    return '1 day ago';
  }

  return `${days} days ago`;
};

export const formatRelativeTime = (timestamp?: number): string => {
  if (!timestamp) {
    return '';
  }
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) {
    return `${Math.max(1, minutes)} min ago`;
  }
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) {
    return `${hours} hr ago`;
  }

  return new Date(timestamp).toLocaleDateString();
};
