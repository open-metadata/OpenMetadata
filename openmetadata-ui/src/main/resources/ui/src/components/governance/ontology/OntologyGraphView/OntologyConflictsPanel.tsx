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
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown, ChevronUp } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyProfileViolation } from '../../../../generated/api/data/ontologyProfileReport';

interface OntologyConflictsPanelProps {
  isChecking: boolean;
  isFailed: boolean;
  violations: OntologyProfileViolation[];
  conceptLabel: (conceptId: string) => string | undefined;
  onOpenConcept: (conceptId: string) => void;
  onValidateAll: () => void;
}

const ConflictRow = ({
  violation,
  conceptLabel,
  onOpenConcept,
}: {
  violation: OntologyProfileViolation;
  conceptLabel: OntologyConflictsPanelProps['conceptLabel'];
  onOpenConcept: (conceptId: string) => void;
}) => (
  <li
    className="tw:flex tw:flex-col tw:gap-1.5 tw:border-t tw:border-secondary tw:px-4 tw:py-3"
    data-testid="ontology-conflict-row">
    <Typography size="text-sm" weight="medium">
      {violation.message}
    </Typography>
    <Box gap={3} wrap="wrap">
      {(violation.conceptIds ?? []).map((conceptId) => (
        <Button
          color="link-destructive"
          data-testid="ontology-conflict-link"
          key={conceptId}
          size="sm"
          onPress={() => onOpenConcept(conceptId)}>
          {conceptLabel(conceptId) ?? conceptId}
        </Button>
      ))}
    </Box>
  </li>
);

/** Lists what the server finds wrong with the working draft, with a link to each concept a clash names. */
const OntologyConflictsPanel = ({
  isChecking,
  isFailed,
  violations,
  conceptLabel,
  onOpenConcept,
  onValidateAll,
}: OntologyConflictsPanelProps) => {
  const { t } = useTranslation();
  const hasConflicts = violations.length > 0;
  // A clean draft keeps only the header row, so the canvas stays clear.
  const [isOpen, setIsOpen] = useState<boolean>();
  const isExpanded = isOpen ?? (hasConflicts || isFailed);
  const toggleLabel = t(isExpanded ? 'label.collapse' : 'label.expand');

  return (
    <Card
      className="tw:absolute tw:top-16 tw:right-4 tw:z-6 tw:flex tw:max-h-[calc(100%-16rem)] tw:w-86 tw:max-w-[calc(100%-2rem)] tw:flex-col tw:overflow-hidden"
      data-testid="ontology-conflicts-panel"
      variant="elevated">
      <Box align="center" className="tw:px-4 tw:py-3" gap={2}>
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <Typography
            data-testid="ontology-conflicts-title"
            size="text-sm"
            weight="semibold">
            {t('label.n-conflicts-to-resolve', { count: violations.length })}
          </Typography>
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
        <Button
          aria-expanded={isExpanded}
          aria-label={toggleLabel}
          color="tertiary"
          data-testid="ontology-conflicts-toggle"
          iconLeading={isExpanded ? ChevronUp : ChevronDown}
          size="sm"
          tooltip={toggleLabel}
          onPress={() => setIsOpen(!isExpanded)}
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
              {violations.map((violation) => (
                <ConflictRow
                  conceptLabel={conceptLabel}
                  key={`${violation.code}-${violation.message}`}
                  violation={violation}
                  onOpenConcept={onOpenConcept}
                />
              ))}
            </ul>
          ) : (
            <Typography
              className="tw:border-t tw:border-secondary tw:px-4 tw:py-3"
              color="secondary"
              size="text-xs">
              {t('message.ontology-validate-all-clean')}
            </Typography>
          )}
        </Box>
      ) : null}
    </Card>
  );
};

export default OntologyConflictsPanel;
