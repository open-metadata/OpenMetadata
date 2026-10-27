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
  Checkbox,
  Grid,
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { OntologyReleaseExportOptions } from '../../../../generated/api/data/ontologyReleaseExportOptions';
import { OntologyReleaseValidation } from '../../../../generated/api/data/ontologyReleaseValidation';
import { NATIVE_EXPORT_EXTENSIONS } from '../../../../rest/ontologyExport.constants';
import {
  ONTOLOGY_RELEASE_EXPORT_FORMATS,
  ONTOLOGY_RELEASE_PREVIEW_LIMIT,
  OntologyReleaseExportCard,
  resolveExportFormat,
} from './OntologyReleaseExportModal.constants';
import OntologyReleaseExportShacl from './OntologyReleaseExportShacl';

export interface OntologyReleaseExportSelection {
  readonly card: OntologyReleaseExportCard;
  readonly options: Required<OntologyReleaseExportOptions>;
  readonly skosXl: boolean;
}

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
  readonly isShaclRunning: boolean;
  readonly selection: OntologyReleaseExportSelection;
  readonly shaclReport?: OntologyReleaseValidation;
  readonly state: OntologyReleaseExportContentState;
  readonly onRunShacl: () => void;
  readonly onSelectionChange: (
    selection: OntologyReleaseExportSelection
  ) => void;
}

const OntologyReleaseExportContent = ({
  isShaclRunning,
  selection,
  shaclReport,
  state,
  onRunShacl,
  onSelectionChange,
}: OntologyReleaseExportContentProps) => {
  const { t } = useTranslation();
  const { card, options, skosXl } = selection;
  const setOption = (changes: Partial<typeof options>) =>
    onSelectionChange({ ...selection, options: { ...options, ...changes } });

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
              value={card}
              onChange={(value) => {
                const option = ONTOLOGY_RELEASE_EXPORT_FORMATS.find(
                  (candidate) => candidate.format === value
                );
                if (option) {
                  onSelectionChange({ ...selection, card: option.format });
                }
              }}>
              {ONTOLOGY_RELEASE_EXPORT_FORMATS.map((option) => (
                <RadioButton
                  data-testid={`ontology-release-format-${option.format}`}
                  hint={t(option.descriptionKey)}
                  key={option.format}
                  label={t(option.labelKey)}
                  trailing={`.${
                    NATIVE_EXPORT_EXTENSIONS[
                      resolveExportFormat(option.format, skosXl)
                    ]
                  }`}
                  value={option.format}
                  variant="card"
                />
              ))}
            </RadioGroup>
            <Box className="tw:mt-4" direction="col" gap={2}>
              {card === 'skos' ? (
                <Checkbox
                  data-testid="ontology-export-skos-xl"
                  isSelected={skosXl}
                  label={t('label.use-skos-xl-labels')}
                  onChange={(value) =>
                    onSelectionChange({ ...selection, skosXl: value })
                  }
                />
              ) : null}
              <Checkbox
                data-testid="ontology-export-inverses"
                isSelected={options.includeInverses}
                label={t('message.include-inverse-relationships')}
                onChange={(value) => setOption({ includeInverses: value })}
              />
              <Checkbox
                data-testid="ontology-export-bound-assets"
                isDisabled={card === 'csv'}
                isSelected={options.includeBoundAssets && card !== 'csv'}
                label={t('label.include-bound-assets')}
                onChange={(value) => setOption({ includeBoundAssets: value })}
              />
              <Checkbox
                data-testid="ontology-export-shacl-gate"
                isSelected={options.shaclGate}
                label={t('label.shacl-gate')}
                onChange={(value) => setOption({ shaclGate: value })}
              />
            </Box>
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
              <OntologyReleaseExportShacl
                isRunning={isShaclRunning}
                report={shaclReport}
                onRun={onRunShacl}
              />
            </Box>
          </Grid.Item>
        </Grid>
      ) : null}
    </Box>
  );
};

export default OntologyReleaseExportContent;
