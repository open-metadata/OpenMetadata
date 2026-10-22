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
  Card,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { FileCheck02 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityStatus } from '../../../../generated/entity/data/glossaryTerm';
import { refreshGlossaryProposals } from '../../../../hooks/governance/glossary/useGlossaryProposals';
import { addTaskComment } from '../../../../rest/tasksAPI';
import { getShortRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { EntityStatusClass } from '../../../../utils/EntityStatusUtils';
import {
  GlossaryProposal,
  ProposalDecision,
} from '../../../../utils/GlossaryReview/GlossaryReview.types';
import {
  getDeciders,
  getProposalLocation,
} from '../../../../utils/GlossaryReview/GlossaryReview.utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import StatusBadge from '../../../common/StatusBadge/StatusBadge.component';
import { LOCATION_SEPARATOR } from './GlossaryReviewTab.constants';
import {
  AgentEvidence,
  DecidersNote,
  ProposalActions,
  ProposedBy,
} from './ProposalCard';

export interface ProposalDetailProps {
  proposal: GlossaryProposal;
  canDecide: boolean;
  onDecide: (decision: ProposalDecision, comment?: string) => Promise<void>;
  onEdit?: () => void;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="tw:text-sm tw:text-tertiary">{label}</dt>
    <dd className="tw:m-0 tw:min-w-0 tw:text-sm tw:text-primary">{children}</dd>
  </>
);

const PersonList = ({ names }: { names: string[] }) => (
  <Box gap={3} wrap="wrap">
    {names.map((name) => (
      <Box align="center" gap={2} key={name}>
        <Avatar alt={name} initials={name.charAt(0).toUpperCase()} size="xs" />
        <span>{name}</span>
      </Box>
    ))}
  </Box>
);

/** The comments on a person's approval request, and a box to add one. */
const RequestComments = ({ proposal }: { proposal: GlossaryProposal }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const task = proposal.approvalTask;
  if (!task) {
    return null;
  }
  const comments = task.comments ?? [];

  const post = async () => {
    const message = draft.trim();
    if (!message) {
      return;
    }
    setIsPosting(true);
    try {
      await addTaskComment(task.id, message);
      setDraft('');
      await refreshGlossaryProposals();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Card.Footer data-testid="proposal-comments">
      <Box direction="col" gap={3}>
        <Typography size="text-sm" weight="semibold">
          {`${t('label.comment-plural')} · ${comments.length}`}
        </Typography>
        {comments.map((comment) => {
          const author = getEntityName(comment.author);

          return (
            <Box gap={2} key={comment.id}>
              <Avatar
                alt={author}
                initials={author.charAt(0).toUpperCase()}
                size="xs"
              />
              <Box direction="col" gap={1}>
                <Box align="center" gap={2}>
                  <Typography size="text-xs" weight="semibold">
                    {author}
                  </Typography>
                  <span className="tw:text-xs tw:text-tertiary">
                    {getShortRelativeTime(comment.createdAt)}
                  </span>
                </Box>
                <RichTextEditorPreviewerNew markdown={comment.message} />
              </Box>
            </Box>
          );
        })}
        <Box align="end" gap={2}>
          <Input
            aria-label={t('label.comment')}
            className="tw:flex-1"
            inputDataTestId="proposal-comment-input"
            placeholder={t('message.leave-a-comment')}
            value={draft}
            onChange={setDraft}
            onKeyDown={(event) => event.key === 'Enter' && post()}
          />
          <Button
            color="secondary"
            data-testid="post-proposal-comment"
            isDisabled={!draft.trim()}
            isLoading={isPosting}
            size="sm"
            onPress={post}>
            {t('label.comment')}
          </Button>
        </Box>
      </Box>
    </Card.Footer>
  );
};

const DetailHeader = ({ proposal }: { proposal: GlossaryProposal }) => {
  const { t } = useTranslation();
  const { term, approvalTask } = proposal;
  const status = term.entityStatus ?? EntityStatus.Draft;

  return (
    <Card.Header
      hasDivider={false}
      title={
        <Box align="center" gap={3} justify="between" wrap="wrap">
          <Box align="center" gap={2}>
            <FileCheck02
              aria-hidden
              className="tw:size-5 tw:text-fg-quaternary"
            />
            <Typography size="text-md" weight="semibold">
              {approvalTask?.taskId && (
                <span className="tw:mr-1.5 tw:text-brand-secondary">
                  {approvalTask.taskId}
                </span>
              )}
              {`${t('label.approval-request-for')} `}
              <span className="tw:text-brand-secondary">
                {getEntityName(term)}
              </span>
            </Typography>
          </Box>
          <StatusBadge label={status} status={EntityStatusClass[status]} />
        </Box>
      }
    />
  );
};

/** What approving the proposal would add to the glossary. */
const ProposedChanges = ({ proposal }: { proposal: GlossaryProposal }) => {
  const { t } = useTranslation();
  const { term } = proposal;
  const location = getProposalLocation(term);
  const synonyms = term.synonyms ?? [];

  return (
    <Box direction="col" gap={2}>
      <Typography size="text-sm" weight="semibold">
        {t('label.proposed-change-plural')}
        <span className="tw:font-normal tw:text-tertiary">
          {` · ${
            term.parent ? t('label.new-child-term') : t('label.new-term')
          }`}
        </span>
      </Typography>
      <dl className="tw:m-0 tw:grid tw:grid-cols-[140px_minmax(0,1fr)] tw:gap-x-4 tw:gap-y-3 tw:rounded-lg tw:border tw:border-secondary tw:p-4">
        <Field label={t('label.name')}>{getEntityName(term)}</Field>
        {location.length > 1 && (
          <Field label={t('label.parent')}>
            {location.join(LOCATION_SEPARATOR)}
          </Field>
        )}
        <Field label={t('label.description')}>
          <RichTextEditorPreviewerNew markdown={term.description ?? ''} />
        </Field>
        {synonyms.length > 0 && (
          <Field label={t('label.synonym-plural')}>{synonyms.join(', ')}</Field>
        )}
      </dl>
    </Box>
  );
};

/** A proposal opened from the review queue: what it changes, why, and its decision. */
const ProposalDetail = ({
  proposal,
  canDecide,
  onDecide,
  onEdit,
}: ProposalDetailProps) => {
  const { t } = useTranslation();
  const isAi = proposal.source === 'ai';
  const deciders = getDeciders(proposal).map((decider) =>
    getEntityName(decider)
  );

  return (
    <Card data-testid="proposal-detail" size="sm">
      <DetailHeader proposal={proposal} />
      <Card.Content>
        <Box direction="col" gap={5}>
          <dl className="tw:m-0 tw:grid tw:grid-cols-[140px_minmax(0,1fr)] tw:items-center tw:gap-x-4 tw:gap-y-3">
            <Field label={t('label.created-by')}>
              <ProposedBy proposal={proposal} />
            </Field>
            {deciders.length > 0 && (
              <Field label={t('label.assignee-plural')}>
                <PersonList names={deciders} />
              </Field>
            )}
            <Field label={t('label.location')}>
              {getProposalLocation(proposal.term).join(LOCATION_SEPARATOR)}
            </Field>
          </dl>
          <ProposedChanges proposal={proposal} />
          {isAi && <AgentEvidence proposal={proposal} />}
          <Box direction="col" gap={3}>
            <span className="tw:text-xs tw:text-tertiary">
              {isAi
                ? t('message.ai-proposal-rule')
                : t('message.person-proposal-rule')}
            </span>
            {canDecide ? (
              <ProposalActions
                isApproveWide={false}
                proposal={proposal}
                onDecide={onDecide}
                onEdit={onEdit}
              />
            ) : (
              <DecidersNote proposal={proposal} />
            )}
          </Box>
        </Box>
      </Card.Content>
      <RequestComments proposal={proposal} />
    </Card>
  );
};

export default ProposalDetail;
