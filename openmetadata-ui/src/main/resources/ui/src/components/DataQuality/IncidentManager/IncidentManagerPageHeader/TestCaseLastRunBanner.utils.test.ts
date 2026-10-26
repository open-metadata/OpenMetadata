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
import type { TFunction } from 'i18next';
import { get } from 'lodash';
import { TestCase } from '../../../../generated/tests/testCase';
import enUS from '../../../../locale/languages/en-us.json';
import { getIncidentTitle } from './TestCaseLastRunBanner.utils';

// English, so the title is checked against its own wording, not against keys.
const t = ((key: string, values?: Record<string, string>) =>
  String(get(enUS, key, key)).replace(
    /{{(\w+)}}/g,
    (_, name: string) => values?.[name] ?? ''
  )) as unknown as TFunction;

const testCase = (definition: string, entityLink: string, value?: string) =>
  ({
    entityLink,
    parameterValues: value ? [{ name: 'value', value }] : [],
    testDefinition: {
      id: 'definition',
      type: 'testDefinition',
      name: definition,
    },
  } as TestCase);

describe('getIncidentTitle', () => {
  it('says what the test checks, and on which table, as the mock heads an incident', () => {
    expect(
      getIncidentTitle(
        testCase(
          'tableRowCountToEqual',
          '<#E::table::svc.db.shop.customers>',
          '10000'
        ),
        t
      )
    ).toBe('Row count vs. expected 10,000 on customers');
  });

  it('names the table of a column test, not the column', () => {
    expect(
      getIncidentTitle(
        testCase(
          'columnValuesToBeNotNull',
          '<#E::table::svc.db.shop.customers::columns::email>'
        ),
        t
      )
    ).toMatch(/ on customers$/);
  });

  it('has no title before the test case loads', () => {
    expect(getIncidentTitle(undefined, t)).toBeUndefined();
  });
});
