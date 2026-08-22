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

import { Button } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

export interface ConfigError {
  field: string;
  reason: string;
}

export interface ConfigErrorPageProps {
  errors: ConfigError[];
  onRetry: () => void;
}

const DOCS_HREF = 'https://docs.open-metadata.org/latest/deployment/security';

const ConfigErrorPage = ({ errors, onRetry }: ConfigErrorPageProps) => {
  const { t } = useTranslation();

  return (
    <main
      className="tw:flex tw:min-h-screen tw:items-center tw:justify-center tw:bg-primary tw:p-6"
      role="main">
      <div
        aria-labelledby="config-error-heading"
        className="tw:flex tw:w-full tw:max-w-xl tw:flex-col tw:gap-6 tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:p-8 tw:shadow-md"
        data-testid="config-error-page"
        role="region">
        <h1
          className="tw:text-2xl tw:font-semibold tw:text-primary"
          id="config-error-heading">
          {t('label.authentication-configuration-error')}
        </h1>

        <p className="tw:text-sm tw:text-secondary">
          {t('message.config-error-summary')}
        </p>

        <section aria-label={t('label.invalid-fields')}>
          <h2 className="tw:mb-2 tw:text-sm tw:font-semibold tw:text-primary">
            {t('label.invalid-fields')}
          </h2>
          <ul
            className="tw:flex tw:flex-col tw:gap-2 tw:text-sm tw:text-secondary"
            data-testid="config-error-list">
            {errors.map((error) => (
              <li
                className="tw:rounded-md tw:border tw:border-error-primary tw:bg-error-primary tw:p-3 tw:text-fg-error-primary"
                data-testid={`config-error-item-${error.field}`}
                key={error.field}>
                <span className="tw:font-mono tw:font-semibold">
                  {error.field}
                </span>
                <span className="tw:mx-2">—</span>
                <span>{error.reason}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label={t('label.next-steps')}>
          <h2 className="tw:mb-2 tw:text-sm tw:font-semibold tw:text-primary">
            {t('label.next-steps')}
          </h2>
          <ol className="tw:ml-5 tw:flex tw:list-decimal tw:flex-col tw:gap-1 tw:text-sm tw:text-secondary">
            <li>{t('message.config-error-step-review')}</li>
            <li>{t('message.config-error-step-restart')}</li>
            <li>{t('message.config-error-step-retry')}</li>
          </ol>
          <p className="tw:mt-3 tw:text-sm tw:text-secondary">
            <a
              className="tw:text-brand-secondary tw:underline"
              href={DOCS_HREF}
              rel="noreferrer"
              target="_blank">
              {t('label.view-documentation')}
            </a>
          </p>
        </section>

        <div className="tw:flex tw:justify-end">
          <Button
            color="primary"
            data-testid="config-error-retry"
            size="md"
            onClick={onRetry}>
            {t('label.retry')}
          </Button>
        </div>
      </div>
    </main>
  );
};

export default ConfigErrorPage;
