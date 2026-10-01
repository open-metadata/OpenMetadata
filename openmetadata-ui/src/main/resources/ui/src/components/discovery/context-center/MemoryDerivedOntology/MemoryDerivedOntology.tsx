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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import {
  OntologyMemoryProposalStatus,
  Proposal,
} from '../../../../generated/api/data/ontologyMemoryProposalStatus';
import { EntityReference } from '../../../../generated/entity/context/contextMemory';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getGlossaryPath } from '../../../../utils/RouterUtils';
import { MemoryDerivedOntologyProps } from './MemoryDerivedOntology.types';
import {
  getDerivedTerms,
  getLastOutcomeMessage,
  getProposalLabel,
  isPublishedMemory,
} from './MemoryDerivedOntology.utils';

const LINK_CLASS_NAME = 'tw:text-link tw:hover:underline';

const DerivedOntologyLinks: FC<{
  derivedTerms: EntityReference[];
  proposals: Proposal[];
  onNavigate: () => void;
}> = ({ derivedTerms, proposals, onNavigate }) => {
  const { t } = useTranslation();

  return (
    <>
      {derivedTerms.map((term) => (
        <Link
          className={LINK_CLASS_NAME}
          key={term.id}
          to={getGlossaryPath(term.fullyQualifiedName)}
          onClick={onNavigate}>
          {getEntityName(term)}
        </Link>
      ))}
      {proposals.map((proposal) => (
        <Link
          className={LINK_CLASS_NAME}
          key={proposal.changeSet.id}
          to={`${ROUTES.ONTOLOGY_EXPLORER}?draft=${encodeURIComponent(
            proposal.changeSet.id
          )}`}
          onClick={onNavigate}>
          {t('label.draft')}: {getProposalLabel(proposal)}
        </Link>
      ))}
    </>
  );
};

const DerivationNotes: FC<{
  hasDerivedOntology: boolean;
  hasDerivedTerms: boolean;
  status?: OntologyMemoryProposalStatus;
}> = ({ hasDerivedOntology, hasDerivedTerms, status }) => {
  const { t } = useTranslation();
  const isQueued = Boolean(status?.queued);
  const outcomeMessage = hasDerivedTerms
    ? undefined
    : getLastOutcomeMessage(status, t);

  return (
    <>
      {!hasDerivedOntology && !isQueued && (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.no-derived-ontology')}
        </Typography>
      )}
      {outcomeMessage && (
        <Typography className="tw:text-tertiary" size="text-xs">
          {outcomeMessage}
        </Typography>
      )}
      {isQueued && (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('label.queued')}
        </Typography>
      )}
    </>
  );
};

const ProposeTermAction: FC<{
  isProposing: boolean;
  isRestricted: boolean;
  proposeError?: string;
  onPropose: () => void;
}> = ({ isProposing, isRestricted, proposeError, onPropose }) => {
  const { t } = useTranslation();

  return (
    <>
      {isRestricted && (
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('message.memory-proposal-reviewer-visibility')}
        </Typography>
      )}
      <Button
        color="secondary"
        isLoading={isProposing}
        size="sm"
        type="button"
        onClick={onPropose}>
        {t('label.propose-term')}
      </Button>
      {proposeError && (
        <Typography className="tw:text-error-primary" size="text-xs">
          {proposeError}
        </Typography>
      )}
    </>
  );
};

const MemoryDerivedOntology: FC<MemoryDerivedOntologyProps> = ({
  memory,
  status,
  canPropose,
  isProposing,
  proposeError,
  onNavigate,
  onPropose,
}) => {
  const { t } = useTranslation();
  const derivedTerms = getDerivedTerms(memory);
  const proposals = status?.proposals ?? [];
  const hasDerivedOntology = derivedTerms.length > 0 || proposals.length > 0;

  // Deployments without memory derivation only see terms that were already derived.
  if (!hasDerivedOntology && !status?.enabled) {
    return null;
  }

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-2"
      data-testid="memory-derived-ontology">
      <Typography size="text-sm" weight="medium">
        {t('label.derived-ontology')}
      </Typography>
      <DerivedOntologyLinks
        derivedTerms={derivedTerms}
        proposals={proposals}
        onNavigate={onNavigate}
      />
      <DerivationNotes
        hasDerivedOntology={hasDerivedOntology}
        hasDerivedTerms={derivedTerms.length > 0}
        status={status}
      />
      {canPropose && (
        <ProposeTermAction
          isProposing={isProposing}
          isRestricted={!isPublishedMemory(memory)}
          proposeError={proposeError}
          onPropose={onPropose}
        />
      )}
    </div>
  );
};

export default MemoryDerivedOntology;
