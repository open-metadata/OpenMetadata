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

import { readFileSync } from 'fs';
import path from 'path';

const LANGUAGE_DIRECTORY = path.resolve(__dirname, '../../locale/languages');
const LOCALES = [
  'ar-sa',
  'de-de',
  'es-es',
  'fr-fr',
  'gl-es',
  'he-he',
  'ja-jp',
  'ko-kr',
  'mr-in',
  'nl-nl',
  'pr-pr',
  'pt-br',
  'pt-pt',
  'ru-ru',
  'sv-se',
  'th-th',
  'tr-tr',
  'zh-cn',
  'zh-tw',
] as const;

const METRIC_TRANSLATION_KEYS = {
  label: [
    'add-child-metric',
    'add-variant',
    'activity-and-task-plural',
    'approval',
    'at-risk',
    'card',
    'columns-feeding-metric',
    'degraded',
    'deprecated',
    'direction',
    'metric-group',
    'metric-hierarchy',
    'parent-metric',
    'resize-entity',
    'rolled-back',
    'rollup-reason',
    'unknown',
    'unrelated',
    'variant',
    'variant-plural',
    'you-are-here',
  ],
  message: [
    'entity-not-found-in-current-page',
    'metric-approval-automatic-workflow',
    'metric-approval-not-required',
    'metric-asset-not-health-relevant',
    'metric-group-optional',
    'metric-group-will-be-created',
    'metric-health-unavailable',
    'metric-not-in-hierarchy',
    'metric-observability-reason-no-terminal-results',
    'metric-observability-score-explanation',
    'no-metric-assets',
    'no-metric-incidents',
    'no-metric-variants',
    'only-upstream-assets-scored',
  ],
} as const;

const PERSIAN_METRIC_WORKFLOW_KEYS = [
  'bulk-edit-add-metric-hint',
  'bulk-edit-create-a-tag',
  'bulk-edit-create-glossary-term',
  'bulk-edit-data-products-empty-description',
  'bulk-edit-data-products-empty-hint',
  'bulk-edit-data-products-placeholder',
  'bulk-edit-data-products-search-placeholder',
  'bulk-edit-domains-empty-description',
  'bulk-edit-domains-empty-hint',
  'bulk-edit-domains-placeholder',
  'bulk-edit-domains-search-placeholder',
  'bulk-edit-glossary-terms-empty-description',
  'bulk-edit-glossary-terms-placeholder',
  'bulk-edit-glossary-terms-search-placeholder',
  'bulk-edit-inline-help',
  'bulk-edit-manage-classifications',
  'bulk-edit-no-data-products-available',
  'bulk-edit-no-domains-available',
  'bulk-edit-no-glossary-terms-yet',
  'bulk-edit-no-owners-available',
  'bulk-edit-no-related-metrics-available',
  'bulk-edit-no-reviewers-available',
  'bulk-edit-no-tags-yet',
  'bulk-edit-open-data-products',
  'bulk-edit-open-domains-settings',
  'bulk-edit-open-glossary',
  'bulk-edit-open-metrics',
  'bulk-edit-open-users',
  'bulk-edit-open-users-and-teams',
  'bulk-edit-owners-empty-description',
  'bulk-edit-owners-placeholder',
  'bulk-edit-owners-search-placeholder',
  'bulk-edit-related-metrics-empty-description',
  'bulk-edit-related-metrics-placeholder',
  'bulk-edit-related-metrics-search-placeholder',
  'bulk-edit-reviewers-empty-description',
  'bulk-edit-reviewers-placeholder',
  'bulk-edit-reviewers-search-placeholder',
  'bulk-edit-selected-count',
  'bulk-edit-tags-empty-description',
  'bulk-edit-tags-placeholder',
  'bulk-edit-tags-search-placeholder',
  'delete-metrics-warning',
  'import-metrics-csv-tip',
  'import-metrics-upload-description',
  'import-metrics-upload-heading',
  'metrics-delete-success',
  'metrics-export-description',
  'metrics-import-description',
  'metrics-rename-collection-description',
] as const;

type TranslationSection = keyof typeof METRIC_TRANSLATION_KEYS;
type LanguageFile = Record<TranslationSection, Record<string, string>>;

const readLanguage = (locale: string): LanguageFile =>
  JSON.parse(
    readFileSync(path.join(LANGUAGE_DIRECTORY, `${locale}.json`), 'utf8')
  ) as LanguageFile;

const english = readLanguage('en-us');

const interpolationTokens = (value: string) =>
  [...value.matchAll(/{{[^}]+}}/g)].map(([token]) => token).sort();

describe('Metric translations', () => {
  it.each(LOCALES)(
    'provides real Metric translations with intact interpolation for %s',
    (locale) => {
      const language = readLanguage(locale);

      for (const section of Object.keys(
        METRIC_TRANSLATION_KEYS
      ) as TranslationSection[]) {
        for (const key of METRIC_TRANSLATION_KEYS[section]) {
          const englishValue = english[section][key];
          const localizedValue = language[section][key];

          expect(localizedValue).toBeTruthy();
          expect(localizedValue).not.toBe(englishValue);
          expect(interpolationTokens(localizedValue)).toEqual(
            interpolationTokens(englishValue)
          );
        }
      }
    }
  );

  it('does not leave Metric workflow placeholders in English for Persian', () => {
    const persian = readLanguage('pr-pr');

    for (const key of PERSIAN_METRIC_WORKFLOW_KEYS) {
      expect(persian.message[key]).toBeTruthy();
      expect(persian.message[key]).not.toBe(english.message[key]);
      expect(interpolationTokens(persian.message[key])).toEqual(
        interpolationTokens(english.message[key])
      );
    }
  });
});
