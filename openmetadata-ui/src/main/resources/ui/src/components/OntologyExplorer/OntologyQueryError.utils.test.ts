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

import { AxiosError, AxiosHeaders } from 'axios';
import { TFunction } from 'i18next';
import { describeQueryError } from './OntologyQueryError.utils';

const t = ((key: string) => key) as unknown as TFunction;

function failure(status: number, body: unknown): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    statusText: '',
    data: body,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

const FEDERATION_BODY = JSON.stringify({
  code: 403,
  message:
    'SPARQL SERVICE clause references http://x/ but federated SPARQL is disabled. Enable rdf.federation.enabled and add the endpoint to rdf.federation.allowedEndpoints.',
});

describe('describeQueryError', () => {
  it('splits a syntax error into a title and the parser line, without the JSON body', () => {
    const body = JSON.stringify({
      code: 400,
      message:
        'Invalid SPARQL query: Lexical error at line 1, column 6.\nWas expecting one of:\n    "not" ...',
    });

    expect(
      describeQueryError(failure(400, body), { isAdmin: false, t })
    ).toEqual({
      title: 'message.query-error-invalid-title',
      hint: 'Lexical error at line 1, column 6.',
    });
  });

  it('never shows the federation configuration keys to a non-admin', () => {
    const display = describeQueryError(failure(403, FEDERATION_BODY), {
      isAdmin: false,
      t,
    });

    expect(display).toEqual({
      title: 'message.query-error-external-title',
      hint: 'message.query-error-external-hint',
    });
    expect(JSON.stringify(display)).not.toContain('rdf.federation');
  });

  it('shows the operator text to an admin', () => {
    const display = describeQueryError(failure(403, FEDERATION_BODY), {
      isAdmin: true,
      t,
    });

    expect(display.hint).toContain('rdf.federation.enabled');
  });

  it.each([
    [403, '{"code":403,"message":"Principal is not allowed"}', 'forbidden'],
    [429, 'busy', 'busy'],
    [503, 'timeout', 'timeout'],
  ])('maps a %s response to its own title', (status, body, key) => {
    expect(
      describeQueryError(failure(status, body), { isAdmin: false, t }).title
    ).toBe(`message.query-error-${key}-title`);
  });

  it('tells the user nothing is published when the ontology has no active release', () => {
    const body = JSON.stringify({
      code: 400,
      message: 'Activate an approved ontology release before querying it',
    });

    expect(
      describeQueryError(failure(400, body), { isAdmin: false, t })
    ).toEqual({
      title: 'message.query-error-nothing-published-title',
      hint: 'message.query-error-nothing-published-hint',
    });
  });

  it('keeps a plain Error message as the hint', () => {
    expect(
      describeQueryError(new Error('Pick a glossary first'), {
        isAdmin: false,
        t,
      })
    ).toEqual({
      title: 'message.query-error-failed-title',
      hint: 'Pick a glossary first',
    });
  });

  it('falls back to the generic hint when the body is not readable text', () => {
    const display = describeQueryError(failure(500, '{"nested":{"a":1}}'), {
      isAdmin: false,
      t,
    });

    expect(display.hint).toBe('server.unexpected-error');
  });
});
