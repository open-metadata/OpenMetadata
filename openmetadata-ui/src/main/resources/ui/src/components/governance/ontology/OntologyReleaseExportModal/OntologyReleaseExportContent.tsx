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
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { OntologyExportFormat } from '../../../../rest/rdfAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
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
      readonly release: OntologyRelease;
    };

interface OntologyReleaseExportContentProps {
  readonly format: OntologyExportFormat;
  readonly ontology: Ontology;
  readonly state: OntologyReleaseExportContentState;
  readonly onFormatChange: (format: OntologyExportFormat) => void;
}

const OntologyReleaseExportContent = ({
  format,
  ontology,
  state,
  onFormatChange,
}: OntologyReleaseExportContentProps) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={5}>
      <Box direction="col" gap={1}>
        <Typography size="text-sm" weight="semibold">
          {getEntityName(ontology)}
        </Typography>
        {state.kind === 'ready' ? (
          <Typography color="secondary" size="text-xs">
            {`${t('label.active')}: ${getEntityName(state.release)}`}
          </Typography>
        ) : null}
      </Box>

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
        <Box className="tw:min-h-0" gap={5}>
          <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={2}>
            <Typography color="secondary" size="text-xs" weight="semibold">
              {t('label.format')}
            </Typography>
            {ONTOLOGY_RELEASE_EXPORT_FORMATS.map((option) => (
              <Button
                noTextPadding
                aria-pressed={format === option.format}
                className={classNames(
                  'tw:w-full tw:justify-start tw:rounded-lg tw:px-3 tw:py-2 tw:text-left',
                  format === option.format
                    ? 'tw:bg-brand-primary tw:after:outline-brand'
                    : 'tw:bg-primary tw:after:outline-secondary'
                )}
                color="tertiary"
                data-testid={`ontology-release-format-${option.format}`}
                key={option.format}
                onPress={() => onFormatChange(option.format)}>
                <Box className="tw:w-full" direction="col" gap={1}>
                  <Typography size="text-sm" weight="semibold">
                    {t(option.labelKey)}
                  </Typography>
                  <Typography color="secondary" size="text-xs">
                    {t(option.descriptionKey)}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Box>

          <Box className="tw:w-[340px] tw:min-w-0" direction="col" gap={2}>
            <Typography color="secondary" size="text-xs" weight="semibold">
              {t('label.preview')}
            </Typography>
            <pre
              className={classNames(
                'tw:min-h-64 tw:flex-1 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary',
                'tw:bg-primary-solid tw:p-4 tw:font-mono tw:text-xs tw:leading-relaxed',
                'tw:whitespace-pre-wrap tw:text-secondary_on-brand'
              )}
              data-testid="ontology-release-export-preview">
              {state.isPreviewLoading
                ? t('label.loading')
                : state.content?.slice(0, ONTOLOGY_RELEASE_PREVIEW_LIMIT) ??
                  '—'}
            </pre>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};

export default OntologyReleaseExportContent;
