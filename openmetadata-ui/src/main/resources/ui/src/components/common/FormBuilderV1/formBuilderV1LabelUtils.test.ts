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

import { getFormDisplayLabel } from './formBuilderV1LabelUtils';

describe('getFormDisplayLabel', () => {
  it('splits camelCase and snake_case field names into words', () => {
    expect(getFormDisplayLabel('hostPort')).toBe('Host Port');
    expect(getFormDisplayLabel('supportsMetadataExtraction')).toBe(
      'Supports Metadata Extraction'
    );
    expect(getFormDisplayLabel('connection_options')).toBe(
      'Connection Options'
    );
  });

  it('restores the casing of known acronyms', () => {
    expect(getFormDisplayLabel('apiVersion')).toBe('API Version');
    expect(getFormDisplayLabel('awsRegion')).toBe('AWS Region');
    expect(getFormDisplayLabel('sslMode')).toBe('SSL Mode');
  });

  it('lowercases dbt, which is styled lowercase even at the start of a label', () => {
    expect(getFormDisplayLabel('dbtConfigSource')).toBe('dbt Config Source');
    expect(getFormDisplayLabel('DBT Cloud Config')).toBe('dbt Cloud Config');
  });

  it('keeps a letter-number acronym together instead of splitting the digit off', () => {
    // startCase alone yields "S 3", which would not match the S3 acronym entry.
    expect(getFormDisplayLabel('s3Config')).toBe('S3 Config');
    expect(getFormDisplayLabel('DBT S3 Config')).toBe('dbt S3 Config');
  });

  it('collapses the two spellings OAuth is split into', () => {
    expect(getFormDisplayLabel('oAuthToken')).toBe('OAuth Token');
    expect(getFormDisplayLabel('oauthConfig')).toBe('OAuth Config');
  });

  it('is idempotent, so an already-rendered label survives a second pass', () => {
    // selectOneOfOption (playwright/utils/serviceFormUtils.ts) is called with either a
    // schema title or the label it renders as, and both must resolve the same option.
    const rendered = getFormDisplayLabel('DBT S3 Config');

    expect(getFormDisplayLabel(rendered)).toBe(rendered);
  });

  it('changes only the casing of the oneOf titles the service-form E2E selects', () => {
    // selectOneOfOption matches these case-insensitively rather than importing this
    // function (playwright may not import app code). That holds only while the transform
    // leaves the letters and spacing alone — this pins that, so a future acronym entry
    // which also respaces a title fails here rather than in the nightly ingestion run.
    const oneOfTitlesSelectedInE2E = [
      'DBT S3 Config',
      'Backend Connection',
      'Local Path',
    ];

    oneOfTitlesSelectedInE2E.forEach((title) => {
      expect(getFormDisplayLabel(title).toLowerCase()).toBe(
        title.toLowerCase()
      );
    });
  });
});
