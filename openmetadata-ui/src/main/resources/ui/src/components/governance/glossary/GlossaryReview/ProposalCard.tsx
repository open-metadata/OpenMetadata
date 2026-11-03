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
  Avatar,
  Box,
  Button,
  ProgressBarBase,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityStatus } from '../../../../generated/entity/data/glossaryTerm';
import contextCenterClassBase from '../../../../utils/ContextCenterClassBase';
import { getShortRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  GlossaryProposal,
  ProposalDecision,
} from '../../../../utils/GlossaryReview/GlossaryReview.types';
import {
  getConfidencePercent,
  getDeciders,
  getProposalAuthor,
} from '../../../../utils/GlossaryReview/GlossaryReview.utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import AgentBadge from '../../../common/AgentBadge/AgentBadge';

/** Heads a proposed term's own page, which already shows its name and definition. */
export interface ProposalCardProps {
  proposal: GlossaryProposal;
  canDecide: boolean;
  onDecide: (decision: ProposalDecision, comment?: string) => Promise<void>;
}

const ProposedBy = ({ proposal }: { proposal: GlossaryProposal }) => {
  const { t } = useTranslation();
  const author = getProposalAuthor(proposal) ?? '';

  return (
    <Box align="center" gap={2} wrap="wrap">
      {proposal.source === 'ai' ? (
        <AgentBadge
          name={proposal.derivation?.evidence?.agent ?? t('label.ai-agent')}
        />
      ) : (
        <Box align="center" className="tw:min-w-0" gap={2}>
          <Avatar
            alt={author}
            initials={author.charAt(0).toUpperCase()}
            size="xs"
          />
          <Typography
            className="tw:min-w-0 tw:wrap-anywhere"
            size="text-xs"
            weight="semibold">
            {author}
          </Typography>
        </Box>
      )}
      <span className="tw:text-xs tw:whitespace-nowrap tw:text-tertiary">
        {getShortRelativeTime(proposal.term.updatedAt)}
      </span>
    </Box>
  );
};

const AgentEvidence = ({ proposal }: { proposal: GlossaryProposal }) => {
  const { t } = useTranslation();
  const { derivation } = proposal;
  const confidence = getConfidencePercent(derivation);
  if (!derivation) {
    return null;
  }

  return (
    <div
      className="tw:rounded-lg tw:border tw:border-utility-purple-100 tw:bg-utility-purple-50 tw:px-3 tw:py-2.5"
      data-testid="proposal-evidence">
      <Box direction="col" gap={2}>
        {confidence !== undefined && (
          <Box align="center" gap={2} wrap="wrap">
            <Typography
              className="tw:shrink-0"
              color="secondary"
              size="text-xs">
              {t('label.confidence')}
            </Typography>
            <ProgressBarBase
              aria-label={t('label.confidence')}
              className="tw:min-w-8 tw:flex-1"
              color="var(--tw-color-utility-purple-500)"
              value={confidence}
            />
            <span className="tw:text-xs tw:font-semibold tw:text-utility-purple-700">
              {`${confidence}%`}
            </span>
          </Box>
        )}
        <Typography color="secondary" size="text-xs" weight="semibold">
          {t('message.why-the-agent-suggested-this')}
        </Typography>
        <ul className="tw:m-0 tw:list-disc tw:pl-4 tw:text-xs tw:break-words tw:text-secondary tw:marker:text-utility-purple-500">
          {(derivation.evidence?.reasons ?? []).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
          <li>
            {t('message.derived-from-memory')}{' '}
            <Link
              data-testid="proposal-source-memory"
              to={`${contextCenterClassBase.getMemoriesListPath()}?memory=${encodeURIComponent(
                derivation.memory.name ?? ''
              )}`}>
              {getEntityName(derivation.memory)}
            </Link>
          </li>
        </ul>
      </Box>
    </div>
  );
};

/** Approve or reject; rejecting first asks why, for the approval request. */
const ProposalActions = ({ onDecide }: Pick<ProposalCardProps, 'onDecide'>) => {
  const { t } = useTranslation();
  const [pendingDecision, setPendingDecision] = useState<ProposalDecision>();
  const [isAskingWhy, setIsAskingWhy] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const isBusy = pendingDecision !== undefined;

  const decide = async (decision: ProposalDecision, comment?: string) => {
    setPendingDecision(decision);
    try {
      await onDecide(decision, comment);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setPendingDecision(undefined);
    }
  };

  if (isAskingWhy) {
    return (
      <Box direction="col" gap={2}>
        <TextArea
          isRequired
          data-testid="proposal-rejection-reason"
          label={t('label.reason-for-rejection')}
          rows={3}
          value={rejectionReason}
          onChange={setRejectionReason}
        />
        <Box gap={2} justify="end">
          <Button
            color="secondary"
            size="sm"
            onPress={() => setIsAskingWhy(false)}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary-destructive"
            data-testid="confirm-reject-proposal"
            isDisabled={!rejectionReason.trim()}
            isLoading={pendingDecision === EntityStatus.Rejected}
            size="sm"
            onPress={() =>
              decide(EntityStatus.Rejected, rejectionReason.trim())
            }>
            {t('label.reject')}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box gap={2} justify="end" wrap="wrap">
      <Button
        color="secondary-destructive"
        data-testid="reject-proposal"
        isDisabled={isBusy}
        isLoading={pendingDecision === EntityStatus.Rejected}
        size="sm"
        onPress={() => setIsAskingWhy(true)}>
        {t('label.reject')}
      </Button>
      <Button
        color="primary"
        data-testid="approve-proposal"
        iconLeading={Check}
        isDisabled={isBusy}
        isLoading={pendingDecision === EntityStatus.Approved}
        size="sm"
        onPress={() => decide(EntityStatus.Approved)}>
        {t('label.approve')}
      </Button>
    </Box>
  );
};

const DecidersNote = ({ proposal }: { proposal: GlossaryProposal }) => {
  const { t } = useTranslation();
  const deciders = getDeciders(proposal);

  return (
    <div className="tw:rounded-lg tw:bg-secondary tw:px-2.5 tw:py-2">
      <span className="tw:text-xs tw:text-tertiary">
        {deciders.length > 0
          ? t('message.waiting-on-deciders', {
              names: deciders
                .map((decider) => getEntityName(decider))
                .join(', '),
            })
          : t('message.waiting-for-approval-request')}
      </span>
    </div>
  );
};

const ProposalCard = ({ proposal, canDecide, onDecide }: ProposalCardProps) => {
  const { t } = useTranslation();
  const isAi = proposal.source === 'ai';

  return (
    <section
      aria-label={getEntityName(proposal.term)}
      className={classNames(
        'tw:rounded-xl tw:border tw:bg-surface tw:p-3.5 tw:shadow-md',
        isAi ? 'tw:border-utility-purple-400' : 'tw:border-utility-warning-400'
      )}
      data-testid="proposal-card-expanded">
      <Box direction="col" gap={3}>
        <ProposedBy proposal={proposal} />
        {isAi && <AgentEvidence proposal={proposal} />}
        <span className="tw:text-xs tw:text-tertiary">
          {isAi
            ? t('message.ai-proposal-rule')
            : t('message.person-proposal-rule')}
        </span>
        {canDecide ? (
          <ProposalActions onDecide={onDecide} />
        ) : (
          <DecidersNote proposal={proposal} />
        )}
      </Box>
    </section>
  );
};

export default ProposalCard;
