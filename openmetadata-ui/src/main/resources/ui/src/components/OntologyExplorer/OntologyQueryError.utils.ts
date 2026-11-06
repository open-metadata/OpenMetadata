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

import { isAxiosError } from 'axios';
import { TFunction } from 'i18next';

export interface QueryErrorDisplay {
  readonly title: string;
  readonly hint: string;
}

interface QueryFailure {
  readonly status?: number;
  readonly message: string;
}

const INVALID_SPARQL_PREFIX = /^Invalid SPARQL query:\s*/i;

// The SPARQL endpoints answer in text, so a failure arrives as the JSON body
// `{"code":400,"message":"..."}` in a string rather than as an object.
function readMessage(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    return String((data as { message: unknown }).message);
  }
  if (typeof data !== 'string') {
    return '';
  }
  try {
    return readMessage(JSON.parse(data));
  } catch {
    return data;
  }
}

function toFailure(error: unknown): QueryFailure {
  if (isAxiosError(error)) {
    return {
      status: error.response?.status,
      message: error.response
        ? readMessage(error.response.data)
        : error.message,
    };
  }

  return { message: error instanceof Error ? error.message : '' };
}

// The first line is the diagnosis; the parser appends its list of expected tokens after it.
function firstLine(message: string): string {
  const line = message.replace(INVALID_SPARQL_PREFIX, '').split('\n')[0].trim();

  return line.startsWith('{') ? '' : line;
}

function isFederationRefusal({ status, message }: QueryFailure): boolean {
  return status === 403 && /federat|SERVICE/i.test(message);
}

const STATUS_MESSAGE_KEYS: Readonly<Record<number, string>> = {
  403: 'forbidden',
  429: 'busy',
  503: 'timeout',
  504: 'timeout',
};

function display(t: TFunction, kind: string, hint?: string): QueryErrorDisplay {
  return {
    title: t(`message.query-error-${kind}-title`),
    hint: hint ?? t(`message.query-error-${kind}-hint`),
  };
}

function classifyBadRequest(
  message: string,
  detail: string,
  t: TFunction
): QueryErrorDisplay {
  if (/approved ontology release/i.test(message)) {
    return display(t, 'nothing-published');
  }
  const kind = INVALID_SPARQL_PREFIX.test(message) ? 'invalid' : 'rejected';

  return display(t, kind, detail || t('server.unexpected-error'));
}

function classify(
  failure: QueryFailure,
  isAdmin: boolean,
  t: TFunction
): QueryErrorDisplay {
  const { status, message } = failure;
  const detail = firstLine(message);

  if (isFederationRefusal(failure)) {
    // Only an operator can act on the configuration keys the server names.
    return display(t, 'external', isAdmin ? message : undefined);
  }
  if (status === 400) {
    return classifyBadRequest(message, detail, t);
  }
  const kind = status === undefined ? undefined : STATUS_MESSAGE_KEYS[status];

  return kind
    ? display(t, kind)
    : display(t, 'failed', detail || t('server.unexpected-error'));
}

/**
 * Turns whatever a query run threw into the title and hint the console shows. Raw server
 * bodies and operator configuration keys never reach the screen.
 */
export function describeQueryError(
  error: unknown,
  options: { readonly isAdmin: boolean; readonly t: TFunction }
): QueryErrorDisplay {
  return classify(toFailure(error), options.isAdmin, options.t);
}
