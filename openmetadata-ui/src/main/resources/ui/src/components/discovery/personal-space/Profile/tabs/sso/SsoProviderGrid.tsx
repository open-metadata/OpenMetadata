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

import { Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { Radio, RadioGroup } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../../../../../../generated/settings/settings';
import { PROVIDER_OPTIONS } from '../../../../../../utils/SSOUtils';

interface SsoProviderGridProps {
  selectedProvider?: AuthProvider;
  onSelect: (provider: AuthProvider) => void;
}

/** Single-choice provider cards; the Configure action lives in the page header. */
const SsoProviderGrid = ({
  selectedProvider,
  onSelect,
}: SsoProviderGridProps) => {
  const { t } = useTranslation();

  return (
    <RadioGroup
      aria-label={t('label.choose-provider')}
      className="tw:flex tw:flex-col tw:gap-4"
      data-testid="sso-provider-grid"
      value={selectedProvider ?? null}
      onChange={(value) => onSelect(value as AuthProvider)}>
      <Typography
        className="tw:text-secondary"
        size="text-md"
        weight="semibold">
        {t('label.choose-provider')}
      </Typography>
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:xl:grid-cols-4">
        {PROVIDER_OPTIONS.map((provider) => (
          <Radio
            className={({ isSelected, isFocusVisible }) =>
              classNames(
                'tw:flex tw:cursor-pointer tw:items-center tw:gap-4 tw:rounded-xl tw:border tw:bg-primary tw:p-4 tw:transition-colors tw:duration-100',
                isSelected
                  ? 'tw:border-brand tw:bg-brand-primary_alt'
                  : 'tw:border-secondary tw:hover:bg-primary_hover',
                isFocusVisible &&
                  'tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring'
              )
            }
            data-testid={`sso-provider-${provider.key}`}
            key={provider.key}
            value={provider.key}>
            <span className="tw:flex tw:size-12 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-secondary tw:bg-primary">
              <img alt="" height={24} src={provider.icon} width={24} />
            </span>
            <Typography size="text-md" weight="semibold">
              {provider.label}
            </Typography>
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
};

export default SsoProviderGrid;
