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
import { Box, Input } from '@openmetadata/ui-core-components';
import { Link01 } from '@openmetadata/ui-core-components/icons';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hyperlink } from '../../../../../generated/type/customProperties/complexTypes';
import { getHyperlinkUrlValidationErrorKey } from '../../../../../utils/CustomProperty.utils';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.types';

const HyperlinkPropertyView = ({ value }: PropertyViewProps) => {
  const hyperlink = value as Hyperlink;
  // Stored values are user input; never render a javascript:/data: href.
  const href = getHyperlinkUrlValidationErrorKey(hyperlink.url)
    ? undefined
    : hyperlink.url;

  return (
    <a
      className="tw:inline-flex tw:max-w-full tw:items-center tw:gap-1.5 tw:break-all tw:text-sm tw:font-medium tw:text-link"
      data-testid="hyperlink-value"
      href={href ?? '#'}
      rel="noopener noreferrer"
      target="_blank">
      <Link01 aria-hidden className="tw:size-3.5 tw:shrink-0" />
      {hyperlink.displayText || hyperlink.url}
    </a>
  );
};

const HyperlinkPropertyEdit = ({
  value,
  isSaving,
  onSave,
  formId,
}: PropertyEditProps) => {
  const { t } = useTranslation();
  const hyperlink = (value ?? {}) as Partial<Hyperlink>;
  const [url, setUrl] = useState(hyperlink.url ?? '');
  const [displayText, setDisplayText] = useState(hyperlink.displayText ?? '');
  const [urlError, setUrlError] = useState<string>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedText = displayText.trim();

    if (!trimmedUrl) {
      if (trimmedText) {
        setUrlError(
          t('label.field-required', { field: t('label.url-uppercase') })
        );

        return;
      }
      onSave(undefined);

      return;
    }

    const errorKey = getHyperlinkUrlValidationErrorKey(trimmedUrl);
    if (errorKey) {
      setUrlError(t(errorKey));

      return;
    }

    onSave({
      url: trimmedUrl,
      ...(trimmedText ? { displayText: trimmedText } : {}),
    });
  };

  return (
    <form noValidate id={formId} onSubmit={handleSubmit}>
      <Box direction="col" gap={2}>
        <Input
          aria-label={t('label.url-uppercase')}
          hint={urlError}
          inputDataTestId="hyperlink-url-input"
          isDisabled={isSaving}
          isInvalid={Boolean(urlError)}
          placeholder={t('label.enter-entity', {
            entity: t('label.url-uppercase'),
          })}
          type="url"
          value={url}
          onChange={(nextUrl) => {
            setUrl(nextUrl);
            setUrlError(undefined);
          }}
        />
        <Box align="start" gap={2}>
          <Input
            aria-label={t('label.display-text')}
            className="tw:flex-1"
            inputDataTestId="hyperlink-display-text-input"
            isDisabled={isSaving}
            placeholder={t('label.enter-entity', {
              entity: t('label.display-text'),
            })}
            value={displayText}
            onChange={setDisplayText}
          />
        </Box>
      </Box>
    </form>
  );
};

export const hyperlinkPropertyRenderer: CustomPropertyRenderer = {
  View: HyperlinkPropertyView,
  Edit: HyperlinkPropertyEdit,
  getEmptyHint: (_property, t) =>
    t('message.example-value', { value: 'https://example.com/runbook' }),
};
