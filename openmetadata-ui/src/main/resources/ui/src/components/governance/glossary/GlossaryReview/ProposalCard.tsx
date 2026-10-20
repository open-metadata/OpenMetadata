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
import {
  AskCollateSparkle,
  Check,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityStatus } from '../../../../generated/entity/data/glossaryTerm';
import { getTextFromHtmlString } from '../../../../utils/BlockEditorPureUtils';
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

export interface ProposalCardProps {
  proposal: GlossaryProposal;
  isExpanded: boolean;
  canDecide: boolean;
  /** Expands a collapsed card; without it the card cannot be collapsed. */
  onExpand?: () => void;
  onDecide: (decision: ProposalDecision, comment?: string) => Promise<void>;
  onEdit?: () => void;
  /**
   * `panel` is a card in the review queue. `banner` heads the proposed term's own page, which
   * already shows its name and definition, so it leaves them out and keeps buttons compact.
   */
  layout?: 'panel' | 'banner';
}

const ProposedBy = ({ proposal }: { proposal: GlossaryProposal }) => {
  const { t } = useTranslation();
  const author = getProposalAuthor(proposal) ?? '';

  return (
    <Box align="center" gap={2}>
      {proposal.source === 'ai' ? (
        <span className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-md tw:bg-utility-purple-100 tw:px-2 tw:py-0.5 tw:text-xs tw:font-semibold tw:whitespace-nowrap tw:text-utility-purple-700">
          <AskCollateSparkle aria-hidden className="tw:size-3" />
          {proposal.derivation?.evidence?.agent ?? t('label.ai-agent')}
        </span>
      ) : (
        <Box align="center" gap={2}>
          <Avatar
            alt={author}
            initials={author.charAt(0).toUpperCase()}
            size="xs"
          />
          <Typography size="text-xs" weight="semibold">
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

const ProposalSummary = ({ proposal }: { proposal: GlossaryProposal }) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={1}>
      <span className="tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-tertiary">
        {proposal.term.parent ? t('label.new-child-term') : t('label.new-term')}
      </span>
      <Typography size="text-sm" weight="semibold">
        {getEntityName(proposal.term)}
      </Typography>
      <Typography className="tw:line-clamp-3" color="secondary" size="text-sm">
        {getTextFromHtmlString(proposal.term.description)}
      </Typography>
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
          <Box align="center" gap={2}>
            <Typography color="secondary" size="text-xs">
              {t('label.confidence')}
            </Typography>
            <ProgressBarBase
              aria-label={t('label.confidence')}
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
        <ul className="tw:m-0 tw:list-disc tw:pl-4 tw:text-xs tw:text-secondary tw:marker:text-utility-purple-500">
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

interface ProposalActionsProps {
  proposal: GlossaryProposal;
  /** Approve takes the free width in the narrow queue, and its natural width elsewhere. */
  isApproveWide: boolean;
  onDecide: (decision: ProposalDecision, comment?: string) => Promise<void>;
  onEdit?: () => void;
}

/** Approve, edit or reject; rejecting a person's proposal first asks why, for its request. */
const ProposalActions = ({
  proposal,
  isApproveWide,
  onDecide,
  onEdit,
}: ProposalActionsProps) => {
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

  const reject = () =>
    proposal.approvalTask
      ? setIsAskingWhy(true)
      : decide(EntityStatus.Rejected);

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
    <Box gap={2}>
      <Button
        className={isApproveWide ? 'tw:flex-1' : undefined}
        color="primary"
        data-testid="approve-proposal"
        iconLeading={Check}
        isDisabled={isBusy}
        isLoading={pendingDecision === EntityStatus.Approved}
        size="sm"
        onPress={() => decide(EntityStatus.Approved)}>
        {t('label.approve')}
      </Button>
      {proposal.source === 'ai' && onEdit && (
        <Button
          color="secondary"
          data-testid="edit-proposal"
          isDisabled={isBusy}
          size="sm"
          onPress={onEdit}>
          {t('label.edit')}
        </Button>
      )}
      <Button
        color="secondary-destructive"
        data-testid="reject-proposal"
        isDisabled={isBusy}
        isLoading={pendingDecision === EntityStatus.Rejected}
        size="sm"
        onPress={reject}>
        {t('label.reject')}
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
          : t('message.waiting-on-glossary-editor')}
      </span>
    </div>
  );
};

const ProposalCard = ({
  proposal,
  isExpanded,
  canDecide,
  onExpand,
  onDecide,
  onEdit,
  layout = 'panel',
}: ProposalCardProps) => {
  const { t } = useTranslation();
  const isAi = proposal.source === 'ai';

  if (!isExpanded) {
    return (
      <button
        className="tw:w-full tw:cursor-pointer tw:rounded-xl tw:border tw:border-secondary tw:bg-secondary_subtle tw:p-3.5 tw:text-left tw:hover:bg-primary_hover"
        data-testid="proposal-card"
        type="button"
        onClick={onExpand}>
        <Box direction="col" gap={3}>
          <ProposedBy proposal={proposal} />
          <ProposalSummary proposal={proposal} />
        </Box>
      </button>
    );
  }

  return (
    <section
      aria-label={getEntityName(proposal.term)}
      className={classNames(
        'tw:rounded-xl tw:border tw:bg-primary tw:p-3.5 tw:shadow-md',
        isAi ? 'tw:border-utility-purple-400' : 'tw:border-utility-warning-400'
      )}
      data-testid="proposal-card-expanded">
      <Box direction="col" gap={3}>
        <ProposedBy proposal={proposal} />
        {layout === 'panel' && <ProposalSummary proposal={proposal} />}
        {isAi && <AgentEvidence proposal={proposal} />}
        <span className="tw:text-xs tw:text-tertiary">
          {isAi
            ? t('message.ai-proposal-rule')
            : t('message.person-proposal-rule')}
        </span>
        {canDecide ? (
          <ProposalActions
            isApproveWide={layout === 'panel'}
            proposal={proposal}
            onDecide={onDecide}
            onEdit={onEdit}
          />
        ) : (
          <DecidersNote proposal={proposal} />
        )}
      </Box>
    </section>
  );
};

export default ProposalCard;
