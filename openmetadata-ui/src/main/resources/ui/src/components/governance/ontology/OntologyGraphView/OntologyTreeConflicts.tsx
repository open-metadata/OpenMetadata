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
  ButtonUtility,
  Dot,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyProfileViolation } from '../../../../generated/api/data/ontologyProfileReport';

interface OntologyTreeConflictsProps {
  readonly isFailed: boolean;
  readonly violations: OntologyProfileViolation[];
  readonly conceptLabel: (conceptId: string) => string | undefined;
  readonly onOpenConcept: (conceptId: string) => void;
  readonly onShowOnGraph: (conceptId: string) => void;
  readonly onRetry: () => void;
}

const ConflictRow = ({
  violation,
  conceptLabel,
  onOpenConcept,
  onShowOnGraph,
}: {
  violation: OntologyProfileViolation;
  conceptLabel: OntologyTreeConflictsProps['conceptLabel'];
  onOpenConcept: (conceptId: string) => void;
  onShowOnGraph: (conceptId: string) => void;
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const conceptIds = violation.conceptIds ?? [];
  const toggleLabel = t(isOpen ? 'label.collapse' : 'label.expand');

  return (
    <li
      className={isOpen ? 'tw:bg-secondary_alt' : undefined}
      data-testid="ontology-tree-conflict">
      <Box align="center" className="tw:min-h-14 tw:px-3" gap={3}>
        <ButtonUtility
          aria-expanded={isOpen}
          aria-label={`${toggleLabel}: ${violation.message}`}
          data-testid="ontology-tree-conflict-toggle"
          icon={isOpen ? ChevronDown : ChevronRight}
          size="xs"
          onPress={() => setIsOpen(!isOpen)}
        />
        <Dot
          aria-hidden="true"
          className="tw:shrink-0 tw:text-fg-error-primary"
          size="sm"
        />
        <Typography className="tw:min-w-0 tw:flex-1" size="text-sm">
          {violation.message}
        </Typography>
        <Typography className="tw:shrink-0" color="danger" size="text-sm">
          {t('label.conflict')}
        </Typography>
        {conceptIds[0] ? (
          <Button
            color="link-color"
            data-testid="ontology-tree-conflict-show-on-graph"
            size="sm"
            onPress={() => onShowOnGraph(conceptIds[0])}>
            {t('label.show-on-graph')}
          </Button>
        ) : null}
      </Box>
      {isOpen ? (
        <Box className="tw:px-4 tw:pb-4">
          <Alert title={violation.message} variant="error">
            <Box gap={4} wrap="wrap">
              {conceptIds.map((conceptId) => (
                <Button
                  color="link-destructive"
                  data-testid="ontology-tree-conflict-open"
                  key={conceptId}
                  size="sm"
                  onPress={() => onOpenConcept(conceptId)}>
                  {t('label.open-entity', {
                    entity: conceptLabel(conceptId) ?? conceptId,
                  })}
                </Button>
              ))}
            </Box>
          </Alert>
        </Box>
      ) : null}
    </li>
  );
};

/**
 * The tree's conflicts, inside its card as the design's Constraints rows: a red
 * dot, the clash, a red "Conflict" status and "Show on graph"; expanding a row
 * opens the callout with a link to each concept the clash names. Nothing shows
 * for a clean draft or a run still pending.
 */
const OntologyTreeConflicts = ({
  isFailed,
  violations,
  conceptLabel,
  onOpenConcept,
  onShowOnGraph,
  onRetry,
}: OntologyTreeConflictsProps) => {
  const { t } = useTranslation();

  if (isFailed) {
    return (
      <Box
        align="center"
        className="tw:min-h-14 tw:px-4"
        data-testid="ontology-tree-conflicts"
        gap={3}>
        <Typography className="tw:flex-1" color="danger" size="text-sm">
          {t('message.ontology-conflicts-check-failed')}
        </Typography>
        <Button color="link-color" size="sm" onPress={onRetry}>
          {t('label.retry')}
        </Button>
      </Box>
    );
  }
  if (violations.length === 0) {
    return null;
  }

  return (
    <ul
      className="tw:m-0 tw:list-none tw:divide-y tw:divide-secondary tw:p-0"
      data-testid="ontology-tree-conflicts">
      {violations.map((violation) => (
        <ConflictRow
          conceptLabel={conceptLabel}
          key={`${violation.code}-${violation.message}`}
          violation={violation}
          onOpenConcept={onOpenConcept}
          onShowOnGraph={onShowOnGraph}
        />
      ))}
    </ul>
  );
};

export default OntologyTreeConflicts;
