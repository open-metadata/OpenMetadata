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

import { startCase } from 'lodash';

const FORM_LABEL_ACRONYMS: Record<string, string> = {
  api: 'API',
  arn: 'ARN',
  aws: 'AWS',
  dbt: 'dbt',
  gcp: 'GCP',
  gcs: 'GCS',
  iam: 'IAM',
  id: 'ID',
  jdbc: 'JDBC',
  jwt: 'JWT',
  odbc: 'ODBC',
  oidc: 'OIDC',
  s3: 'S3',
  saml: 'SAML',
  sql: 'SQL',
  ssh: 'SSH',
  ssl: 'SSL',
  uri: 'URI',
  url: 'URL',
};

const getMergedLetterNumberTokens = (tokens: string[]) =>
  tokens.reduce<string[]>((acc, token) => {
    const previousToken = acc[acc.length - 1];

    if (
      previousToken &&
      /^[0-9]+$/.test(token) &&
      /^[A-Z]{1,3}$/.test(previousToken)
    ) {
      acc[acc.length - 1] = `${previousToken}${token}`;

      return acc;
    }

    acc.push(token);

    return acc;
  }, []);

export const getFormDisplayLabel = (value: string) =>
  getMergedLetterNumberTokens(startCase(value).split(' '))
    .map((token) => FORM_LABEL_ACRONYMS[token.toLowerCase()] ?? token)
    .join(' ')
    .replace(/\bO Auth\b/g, 'OAuth')
    .replace(/\bOauth\b/g, 'OAuth');
