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
  Alert,
  Box,
  Button,
  Grid,
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import {
  EXPORT_FORMAT_TO_FILE_EXTENSION,
  OntologyExportFormat,
} from '../../../../rest/rdfAPI';
import {
  ONTOLOGY_RELEASE_EXPORT_FORMATS,
  ONTOLOGY_RELEASE_PREVIEW_LIMIT,
} from './OntologyReleaseExportModal.constants';

export type OntologyReleaseExportContentState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly onRetry: () => void }
  | { readonly kind: 'loading' }
  | {
      readonly content?: string;
      readonly isPreviewLoading: boolean;
      readonly kind: 'ready';
    };

interface OntologyReleaseExportContentProps {
  readonly format: OntologyExportFormat;
  readonly state: OntologyReleaseExportContentState;
  readonly onFormatChange: (format: OntologyExportFormat) => void;
}

const OntologyReleaseExportContent = ({
  format,
  state,
  onFormatChange,
}: OntologyReleaseExportContentProps) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={5}>
      {state.kind === 'loading' ? (
        <Typography role="status">{t('label.loading')}</Typography>
      ) : null}
      {state.kind === 'empty' ? (
        <Alert variant="warning">
          {t('message.no-active-ontology-release')}
        </Alert>
      ) : null}
      {state.kind === 'error' ? (
        <Box direction="col" gap={3}>
          <Alert variant="error">
            {t('message.ontology-review-unavailable')}
          </Alert>
          <Button color="secondary" size="sm" onPress={state.onRetry}>
            {t('label.retry')}
          </Button>
        </Box>
      ) : null}

      {state.kind === 'ready' ? (
        <Grid className="tw:md:gap-x-5" rowGap="5">
          <Grid.Item className="tw:min-w-0 tw:md:col-span-13">
            <RadioGroup
              label={t('label.format')}
              value={format}
              onChange={(value) => {
                const option = ONTOLOGY_RELEASE_EXPORT_FORMATS.find(
                  (candidate) => candidate.format === value
                );
                if (option) {
                  onFormatChange(option.format);
                }
              }}>
              {ONTOLOGY_RELEASE_EXPORT_FORMATS.map((option) => (
                <RadioButton
                  data-testid={`ontology-release-format-${option.format}`}
                  hint={t(option.descriptionKey)}
                  key={option.format}
                  label={t(option.labelKey)}
                  trailing={`.${
                    EXPORT_FORMAT_TO_FILE_EXTENSION[option.format]
                  }`}
                  value={option.format}
                  variant="card"
                />
              ))}
            </RadioGroup>
          </Grid.Item>
          <Grid.Item className="tw:min-w-0 tw:md:col-span-11">
            <Box className="tw:h-full" direction="col" gap={2}>
              <Typography color="secondary" size="text-sm" weight="medium">
                {t('label.preview')}
              </Typography>
              <pre
                className={classNames(
                  'tw:m-0 tw:min-h-64 tw:max-h-96 tw:flex-1 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary',
                  'tw:bg-primary-solid tw:p-4 tw:font-mono tw:text-xs tw:leading-relaxed',
                  'tw:whitespace-pre-wrap tw:break-words tw:text-primary_on-brand'
                )}
                data-testid="ontology-release-export-preview">
                {state.isPreviewLoading
                  ? t('label.loading')
                  : state.content?.slice(0, ONTOLOGY_RELEASE_PREVIEW_LIMIT) ??
                    '—'}
              </pre>
            </Box>
          </Grid.Item>
        </Grid>
      ) : null}
    </Box>
  );
};

export default OntologyReleaseExportContent;
