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
    className="tw:flex tw:flex-col tw:gap-1"
    data-testid="ontology-conflict-row">
    <Typography size="text-sm">{violation.message}</Typography>
    <Box gap={2} wrap="wrap">
      {(violation.conceptIds ?? []).map((conceptId) => (
        <Button
          color="link-color"
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

  return (
    <Card data-testid="ontology-conflicts-panel" size="sm" variant="muted">
      <Card.Content className="tw:flex tw:flex-col tw:gap-3">
        <Box align="center" gap={2} justify="between">
          <Typography
            data-testid="ontology-conflicts-title"
            size="text-sm"
            weight="semibold">
            {t('label.n-conflicts-to-resolve', { count: violations.length })}
          </Typography>
          <Button
            color="secondary"
            data-testid="ontology-validate-all"
            isLoading={isChecking}
            size="sm"
            onPress={onValidateAll}>
            {t('label.validate-all')}
          </Button>
        </Box>
        {isFailed ? (
          <Alert variant="error">{t('server.unexpected-error')}</Alert>
        ) : null}
        {violations.length ? (
          <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0">
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
          <Typography color="secondary" size="text-xs">
            {t('message.ontology-validate-all-clean')}
          </Typography>
        )}
      </Card.Content>
    </Card>
  );
};

export default OntologyConflictsPanel;
