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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Alert,
  Box,
  Button,
  Checkbox,
  RadioButton,
  RadioGroup,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { OntologyReleaseValidation } from '../../../../generated/api/data/ontologyReleaseValidation';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { ONTOLOGY_DRAFT_EXPORT_SCOPE } from '../../../../hooks/governance/ontology/useOntologyReleaseExport';
import { NATIVE_EXPORT_EXTENSIONS } from '../../../../rest/ontologyExport.constants';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  ONTOLOGY_RELEASE_EXPORT_FORMATS,
  ONTOLOGY_RELEASE_PREVIEW_LIMIT,
  resolveExportFormat,
} from './OntologyReleaseExportModal.constants';
import {
  OntologyReleaseExportContentState,
  OntologyReleaseExportScopeOption,
  OntologyReleaseExportSelection,
} from './OntologyReleaseExportModal.types';
import OntologyReleaseExportShacl from './OntologyReleaseExportShacl';

interface OntologyReleaseExportContentProps {
  readonly activeRelease?: OntologyRelease;
  readonly isDraft: boolean;
  readonly isShaclRunning: boolean;
  readonly scopeKey: string;
  readonly scopes: readonly OntologyReleaseExportScopeOption[];
  readonly selection: OntologyReleaseExportSelection;
  readonly shaclReport?: OntologyReleaseValidation;
  readonly state: OntologyReleaseExportContentState;
  readonly onRunShacl: () => void;
  readonly onScopeChange: (scopeKey: string) => void;
  readonly onSelectionChange: (
    selection: OntologyReleaseExportSelection
  ) => void;
}

const withCard = (
  selection: OntologyReleaseExportSelection,
  value: string
): OntologyReleaseExportSelection => {
  const option = ONTOLOGY_RELEASE_EXPORT_FORMATS.find(
    (candidate) => candidate.format === value
  );

  return option ? { ...selection, card: option.format } : selection;
};

const ExportPreview = ({
  content,
  isLoading,
}: {
  readonly content?: string;
  readonly isLoading?: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <pre
      className={
        'tw:m-0 tw:max-h-72 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary_alt tw:p-4 ' +
        'tw:font-mono tw:text-xs tw:leading-relaxed tw:whitespace-pre-wrap tw:break-words tw:text-secondary'
      }
      data-testid="ontology-release-export-preview">
      {isLoading
        ? t('label.loading')
        : content?.slice(0, ONTOLOGY_RELEASE_PREVIEW_LIMIT) ?? '—'}
    </pre>
  );
};

const ExportLoadState = ({
  state,
}: {
  readonly state: OntologyReleaseExportContentProps['state'];
}) => {
  const { t } = useTranslation();

  if (state.kind === 'loading') {
    return <Typography role="status">{t('label.loading')}</Typography>;
  }
  if (state.kind !== 'error') {
    return null;
  }

  return (
    <Box direction="col" gap={3}>
      <Alert variant="error">
        {t('message.ontology-export-failed')}
        {state.reason ? ` ${state.reason}` : null}
      </Alert>
      <Button color="secondary" size="sm" onPress={state.onRetry}>
        {t('label.retry')}
      </Button>
    </Box>
  );
};

const ExportScopeSelect = ({
  scopeKey,
  scopes,
  onScopeChange,
}: Pick<
  OntologyReleaseExportContentProps,
  'scopeKey' | 'scopes' | 'onScopeChange'
>) => {
  const { t } = useTranslation();

  return (
    <Select
      data-testid="ontology-export-scope"
      hint={t('message.ontology-export-scope-help')}
      label={t('label.scope')}
      selectedKey={scopeKey}
      onSelectionChange={(key) => onScopeChange(String(key))}>
      {scopes.map((scope) => (
        <Select.Item
          id={scope.key}
          key={scope.key}
          label={scope.label}
          supportingText={scope.hint}
        />
      ))}
    </Select>
  );
};

const PUBLISHED_CONTENTS = 'published';

const ExportContentsChoice = ({
  activeRelease,
  scopeKey,
  onScopeChange,
}: Pick<
  OntologyReleaseExportContentProps,
  'activeRelease' | 'scopeKey' | 'onScopeChange'
>) => {
  const { t } = useTranslation();
  let value: string | null = null;
  if (scopeKey === ONTOLOGY_DRAFT_EXPORT_SCOPE) {
    value = ONTOLOGY_DRAFT_EXPORT_SCOPE;
  } else if (scopeKey === activeRelease?.id) {
    value = PUBLISHED_CONTENTS;
  }

  return (
    <RadioGroup
      data-testid="ontology-export-contents"
      label={t('label.contents')}
      value={value}
      onChange={(next) =>
        onScopeChange(
          next === PUBLISHED_CONTENTS && activeRelease
            ? activeRelease.id
            : ONTOLOGY_DRAFT_EXPORT_SCOPE
        )
      }>
      <RadioButton
        data-testid="ontology-export-contents-published"
        hint={
          activeRelease
            ? getEntityName(activeRelease)
            : t('message.ontology-export-no-published-release')
        }
        isDisabled={!activeRelease}
        label={t('label.published-release')}
        value={PUBLISHED_CONTENTS}
      />
      <RadioButton
        data-testid="ontology-export-contents-draft"
        hint={t('message.ontology-export-draft-hint')}
        label={t('label.current-draft')}
        value={ONTOLOGY_DRAFT_EXPORT_SCOPE}
      />
    </RadioGroup>
  );
};

const ExportFormatChoice = ({
  selection,
  onSelectionChange,
}: Pick<
  OntologyReleaseExportContentProps,
  'selection' | 'onSelectionChange'
>) => {
  const { t } = useTranslation();

  return (
    <RadioGroup
      label={t('label.format')}
      value={selection.card}
      onChange={(value) => onSelectionChange(withCard(selection, value))}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
        {ONTOLOGY_RELEASE_EXPORT_FORMATS.map((option) => (
          <RadioButton
            className="tw:flex-row-reverse"
            data-testid={`ontology-release-format-${option.format}`}
            hint={t(option.descriptionKey)}
            key={option.format}
            label={
              <>
                {t(option.labelKey)}{' '}
                <span className="tw:font-normal tw:text-tertiary">
                  {`.${
                    NATIVE_EXPORT_EXTENSIONS[
                      resolveExportFormat(option.format, selection.skosXl)
                    ]
                  }`}
                </span>
              </>
            }
            value={option.format}
            variant="card"
          />
        ))}
      </div>
    </RadioGroup>
  );
};

const ExportAdvanced = ({
  isDraft,
  isShaclRunning,
  scopeKey,
  scopes,
  selection,
  shaclReport,
  state,
  onRunShacl,
  onScopeChange,
  onSelectionChange,
}: Omit<OntologyReleaseExportContentProps, 'activeRelease'>) => {
  const { t } = useTranslation();
  const { card, options, skosXl } = selection;
  const setOption = (changes: Partial<typeof options>) =>
    onSelectionChange({ ...selection, options: { ...options, ...changes } });

  return (
    <Accordion>
      <AccordionItem id="advanced">
        <AccordionHeader data-testid="ontology-export-advanced">
          {t('label.advanced')}
        </AccordionHeader>
        <AccordionPanel>
          <Box direction="col" gap={4}>
            <ExportScopeSelect
              scopeKey={scopeKey}
              scopes={scopes}
              onScopeChange={onScopeChange}
            />
            <Box direction="col" gap={2}>
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
                isDisabled={card === 'csv' || isDraft}
                isSelected={
                  options.includeBoundAssets && card !== 'csv' && !isDraft
                }
                label={t('label.include-bound-assets')}
                onChange={(value) => setOption({ includeBoundAssets: value })}
              />
              <Checkbox
                data-testid="ontology-export-shacl-gate"
                isDisabled={isDraft}
                isSelected={options.shaclGate && !isDraft}
                label={t('label.shacl-gate')}
                onChange={(value) => setOption({ shaclGate: value })}
              />
            </Box>
            <Box direction="col" gap={2}>
              <Typography color="secondary" size="text-sm" weight="medium">
                {t('label.preview')}
              </Typography>
              <ExportPreview
                content={state.kind === 'ready' ? state.content : undefined}
                isLoading={state.kind === 'ready' && state.isPreviewLoading}
              />
            </Box>
            {isDraft ? null : (
              <OntologyReleaseExportShacl
                isRunning={isShaclRunning}
                report={shaclReport}
                onRun={onRunShacl}
              />
            )}
          </Box>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
};

const OntologyReleaseExportContent = ({
  activeRelease,
  state,
  ...props
}: OntologyReleaseExportContentProps) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={5}>
      <Typography color="secondary" size="text-sm">
        {t('message.ontology-export-help')}
      </Typography>
      <ExportLoadState state={state} />
      {/* A failed preview or scope read must not hide the choices, which can recover it. */}
      {state.kind === 'loading' ? null : (
        <>
          <ExportFormatChoice
            selection={props.selection}
            onSelectionChange={props.onSelectionChange}
          />
          <ExportContentsChoice
            activeRelease={activeRelease}
            scopeKey={props.scopeKey}
            onScopeChange={props.onScopeChange}
          />
          <ExportAdvanced {...props} state={state} />
        </>
      )}
    </Box>
  );
};

export default OntologyReleaseExportContent;
