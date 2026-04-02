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

import { EntityType } from '../enums/entity.enum';
import {
  buildRequestAccessUrl,
  getRequestAccessTemplate,
} from './RequestAccessUtils';

describe('RequestAccessUtils', () => {
  it('should extract request access template from service connection options', () => {
    expect(
      getRequestAccessTemplate({
        connection: {
          config: {
            connectionOptions: {
              requestAccessUrl:
                'https://access.example.com/new?asset={{entityFqnEncoded}}',
            },
          },
        },
      } as never)
    ).toBe('https://access.example.com/new?asset={{entityFqnEncoded}}');
  });

  it('should build request access url with entity context placeholders', () => {
    const requestAccessUrl = buildRequestAccessUrl(
      'https://access.example.com/new?name={{entityNameEncoded}}&asset={{entityUrlEncoded}}',
      {
        entityName: 'Finance Dashboard',
        entityPath: '/dashboard/sample.finance_dashboard',
        entityType: EntityType.DASHBOARD,
        fullyQualifiedName: 'sample.finance_dashboard',
      },
      'https://openmetadata.example.com'
    );

    expect(requestAccessUrl).toBe(
      'https://access.example.com/new?name=Finance%20Dashboard&asset=https%3A%2F%2Fopenmetadata.example.com%2Fdashboard%2Fsample.finance_dashboard'
    );
  });

  it('should not build a request access url for unsupported entity types', () => {
    expect(
      buildRequestAccessUrl('https://access.example.com/new', {
        entityType: EntityType.TABLE,
      })
    ).toBeUndefined();
  });

  it('should reject request access urls with non-http protocols', () => {
    expect(
      buildRequestAccessUrl('javascript:alert(document.domain)', {
        entityType: EntityType.DASHBOARD,
      })
    ).toBeUndefined();
  });
});
