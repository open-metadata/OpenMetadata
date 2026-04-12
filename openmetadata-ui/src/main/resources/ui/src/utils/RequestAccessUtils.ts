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

const ENTITY_FQN_ENCODED_TOKEN = '{{entityFqnEncoded}}';
const ENTITY_URL_ENCODED_TOKEN = '{{entityUrlEncoded}}';

export const REQUEST_ACCESS_URL = 'requestAccessUrl';
export const REQUEST_ACCESS_URL_TEMPLATE = 'requestAccessUrlTemplate';

export type RequestAccessConnectionOptions = Record<string, string> | undefined;

const isSafeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);

    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

export const resolveRequestAccessUrl = (
  template: string,
  entityFqn: string,
  entityUrl: string
) => {
  return template
    .replaceAll(ENTITY_FQN_ENCODED_TOKEN, encodeURIComponent(entityFqn))
    .replaceAll(ENTITY_URL_ENCODED_TOKEN, encodeURIComponent(entityUrl));
};

export const getRequestAccessUrl = ({
  connectionOptions,
  entityFqn,
  entityUrl,
}: {
  connectionOptions?: RequestAccessConnectionOptions;
  entityFqn: string;
  entityUrl: string;
}) => {
  const directUrl = connectionOptions?.[REQUEST_ACCESS_URL]?.trim();

  if (directUrl && isSafeUrl(directUrl)) {
    return directUrl;
  }

  const template = connectionOptions?.[REQUEST_ACCESS_URL_TEMPLATE]?.trim();

  if (!template) {
    return null;
  }

  const resolved = resolveRequestAccessUrl(template, entityFqn, entityUrl);

  return isSafeUrl(resolved) ? resolved : null;
};
