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
  Badge,
  Box,
  Button,
  ButtonUtility,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAxiomProvenance,
  getConflictRule,
  OntologyConflict,
  splitConflictMessage,
} from './OntologyConflicts.utils';

interface OntologyConflictsPanelProps {
  isChecking: boolean;
  isFailed: boolean;
  conflicts: OntologyConflict[];
  conceptLabel: (conceptId: string) => string | undefined;
  onResolve: (conceptId: string) => void;
  onValidateAll: () => void;
}

const ConflictRow = ({
  conflict,
  conceptLabel,
  onResolve,
}: {
  conflict: OntologyConflict;
  conceptLabel: OntologyConflictsPanelProps['conceptLabel'];
  onResolve: (conceptId: string) => void;
}) => {
  const { t } = useTranslation();
  const { conceptIds = [], message } = conflict.violation;
  const names = conceptIds.map((id) => conceptLabel(id) ?? '');
  const rule = getConflictRule(conflict) ?? conflict.parts[0];
  const provenance = getAxiomProvenance(rule?.axiom, t);

  return (
    <li
      className="tw:flex tw:flex-col tw:gap-1 tw:border-t tw:border-secondary tw:px-4 tw:pt-3 tw:pb-2"
      data-testid="ontology-conflict-row">
      <Typography className="tw:break-words tw:text-secondary" size="text-sm">
        {splitConflictMessage(message, names).map(({ isName, offset, text }) =>
          isName ? (
            <strong className="tw:font-semibold tw:text-primary" key={offset}>
              {text}
            </strong>
          ) : (
            text
          )
        )}
      </Typography>
      {provenance ? (
        <Typography
          className="tw:truncate"
          color="secondary"
          data-testid="ontology-conflict-provenance"
          size="text-xs">
          {provenance}
        </Typography>
      ) : null}
      {conceptIds[0] ? (
        <Box>
          <Button
            color="link-destructive"
            data-testid="ontology-conflict-resolve"
            iconTrailing={ChevronRight}
            size="sm"
            onPress={() => onResolve(conceptIds[0])}>
            {t('label.resolve')}
          </Button>
        </Box>
      ) : null}
    </li>
  );
};

/** A failed run has no count; "0 conflicts" would read as a clean draft. */
const ConflictsTitle = ({
  count,
  isFailed,
}: {
  count: number;
  isFailed: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <Typography
      color={isFailed ? 'danger' : undefined}
      data-testid="ontology-conflicts-title"
      size="text-sm"
      weight="semibold">
      {isFailed
        ? t('message.ontology-conflicts-check-failed')
        : t('label.conflicts-to-resolve', { count })}
    </Typography>
  );
};

/** Lists what the server finds wrong with the working draft; Resolve opens the clashing concept. */
const OntologyConflictsPanel = ({
  isChecking,
  isFailed,
  conflicts,
  conceptLabel,
  onResolve,
  onValidateAll,
}: OntologyConflictsPanelProps) => {
  const { t } = useTranslation();
  const hasConflicts = conflicts.length > 0;
  const [isExpanded, setIsExpanded] = useState(true);
  const toggleLabel = t(isExpanded ? 'label.collapse' : 'label.expand');

  // As in the design, the card exists only while there is something to resolve;
  // a clean draft or a run still pending leaves the canvas clear.
  if (!hasConflicts && !isFailed) {
    return null;
  }

  return (
    <Card
      className="tw:absolute tw:top-16 tw:right-4 tw:z-6 tw:flex tw:max-h-[calc(100%-16rem)] tw:w-86 tw:max-w-[calc(100%-2rem)] tw:flex-col tw:overflow-hidden"
      data-testid="ontology-conflicts-panel"
      variant="elevated">
      <Box align="center" className="tw:px-4 tw:py-3" gap={2}>
        {hasConflicts ? (
          <Badge
            color="error"
            data-testid="ontology-conflicts-count"
            size="sm"
            type="pill-color">
            {conflicts.length}
          </Badge>
        ) : null}
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <ConflictsTitle count={conflicts.length} isFailed={isFailed} />
          {hasConflicts ? (
            <Typography color="secondary" size="text-xs">
              {t('message.ontology-conflicts-block-publishing')}
            </Typography>
          ) : null}
        </Box>
        <Button
          color="secondary"
          data-testid="ontology-validate-all"
          isLoading={isChecking}
          size="sm"
          onPress={onValidateAll}>
          {t('label.validate-all')}
        </Button>
        <ButtonUtility
          aria-expanded={isExpanded}
          aria-label={toggleLabel}
          data-testid="ontology-conflicts-toggle"
          icon={isExpanded ? ChevronUp : ChevronDown}
          size="lg"
          tooltip={toggleLabel}
          onPress={() => setIsExpanded(!isExpanded)}
        />
      </Box>
      {isExpanded ? (
        <Box className="tw:min-h-0 tw:overflow-y-auto" direction="col">
          {isFailed ? (
            <Box className="tw:px-4 tw:pb-3">
              <Alert variant="error">{t('server.unexpected-error')}</Alert>
            </Box>
          ) : null}
          {hasConflicts ? (
            <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:p-0">
              {conflicts.map((conflict) => (
                <ConflictRow
                  conceptLabel={conceptLabel}
                  conflict={conflict}
                  key={`${conflict.violation.code}-${conflict.violation.message}`}
                  onResolve={onResolve}
                />
              ))}
            </ul>
          ) : null}
        </Box>
      ) : null}
    </Card>
  );
};

export default OntologyConflictsPanel;
