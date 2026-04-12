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
import {
  getRequestAccessUrl,
  resolveRequestAccessUrl,
} from './RequestAccessUtils';

describe('RequestAccessUtils', () => {
  it('should resolve encoded entity placeholders in URL templates', () => {
    const result = resolveRequestAccessUrl(
      'https://access.example.com/new?asset={{entityFqnEncoded}}&url={{entityUrlEncoded}}',
      'sample.service.db',
      'http://localhost:3000/database/sample.service.db'
    );

    expect(result).toBe(
      'https://access.example.com/new?asset=sample.service.db&url=http%3A%2F%2Flocalhost%3A3000%2Fdatabase%2Fsample.service.db'
    );
  });

  it('should prefer requestAccessUrl over requestAccessUrlTemplate', () => {
    const result = getRequestAccessUrl({
      connectionOptions: {
        requestAccessUrl: 'https://access.example.com/direct',
        requestAccessUrlTemplate:
          'https://access.example.com/new?asset={{entityFqnEncoded}}',
      },
      entityFqn: 'sample.service.db',
      entityUrl: 'http://localhost:3000/database/sample.service.db',
    });

    expect(result).toBe('https://access.example.com/direct');
  });

  it('should return null when request access connection options are missing', () => {
    const result = getRequestAccessUrl({
      connectionOptions: {},
      entityFqn: 'sample.service.db',
      entityUrl: 'http://localhost:3000/database/sample.service.db',
    });

    expect(result).toBeNull();
  });

  it('should reject unsafe URL protocols', () => {
    const resultDirect = getRequestAccessUrl({
      connectionOptions: {
        requestAccessUrl: 'javascript:alert(1)',
      },
      entityFqn: 'sample.service.db',
      entityUrl: 'http://localhost:3000/database/sample.service.db',
    });

    expect(resultDirect).toBeNull();

    const resultTemplate = getRequestAccessUrl({
      connectionOptions: {
        requestAccessUrlTemplate: 'data:text/html,hello',
      },
      entityFqn: 'sample.service.db',
      entityUrl: 'http://localhost:3000/database/sample.service.db',
    });

    expect(resultTemplate).toBeNull();
  });
});
