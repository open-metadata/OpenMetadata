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
  Avatar,
  Badge,
  Box,
  Button,
  ButtonUtility,
  Card,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, XClose } from '@openmetadata/ui-core-components/icons';
import { lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssigneeStatus } from '../../../../generated/api/data/ontologyReleaseReview';
import { OntologyApprovalRule } from '../../../../generated/entity/data/ontology';
import { EntityReference } from '../../../../generated/type/entityReference';
import type {
  ReviewSettings,
  SettingsOutcome,
} from '../../../../hooks/governance/ontology/useOntologyPublication.types';
import { useSettlingReviewEdits } from '../../../../hooks/governance/ontology/useSettlingReviewEdits';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import Loader from '../../../common/Loader/Loader';
import type { ReleasePanelView } from './OntologyReleasePanel.types';

interface OntologyReleaseReviewersProps {
  view: ReleasePanelView;
  onChange: (settings: ReviewSettings) => Promise<SettingsOutcome>;
  onRefresh: () => Promise<void>;
}

const ASSIGNEE_COLORS: Record<AssigneeStatus, 'success' | 'error' | 'warning'> =
  {
    [AssigneeStatus.Approved]: 'success',
    [AssigneeStatus.Rejected]: 'error',
    [AssigneeStatus.Pending]: 'warning',
  };
const UserTeamSelectableList = withSuspenseFallback(
  lazy(() =>
    import(
      '../../../common/UserTeamSelectableList/UserTeamSelectableList.component'
    ).then((m) => ({ default: m.UserTeamSelectableList }))
  ),
  null
);

type ReadyReviewerModel = Extract<ReleasePanelView, { kind: 'ready' }>['value'];

const retainReadableModel = (
  view: ReleasePanelView,
  retained: { current: ReadyReviewerModel | undefined },
  readEpoch: { current: number }
) => {
  if (view.kind === 'ready') {
    retained.current = view.value;
  } else if (view.kind === 'unavailable' && retained.current) {
    retained.current = undefined;
    readEpoch.current += 1;
  }

  return retained.current;
};

const OntologyReleaseReviewers = ({
  view,
  onChange,
  onRefresh,
}: OntologyReleaseReviewersProps) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SettingsOutcome>();
  const readEpoch = useRef(0);
  const retained = useRef<ReadyReviewerModel>();
  const model = retainReadableModel(view, retained, readEpoch);
  useEffect(() => {
    if (view.kind === 'unavailable') {
      setOutcome(undefined);
      setSaving(false);
    }
  }, [view.kind]);
  const save = async (next: ReviewSettings) => {
    const epoch = readEpoch.current;
    setSaving(true);
    setOutcome(undefined);
    try {
      const result = await onChange(next);
      if (readEpoch.current === epoch) {
        setOutcome(result);
      }
    } finally {
      if (readEpoch.current === epoch) {
        setSaving(false);
      }
    }
  };
  const { interactive, change } = useSettlingReviewEdits({
    viewKind: view.kind,
    canEditSettings: model?.canEditSettings,
    saving,
    settings: model?.settings,
    save,
  });
  if (!model) {
    return view.kind === 'loading' ? (
      <Loader size="small" />
    ) : (
      <Alert variant="error">
        {t('message.ontology-review-settings-unavailable')}
      </Alert>
    );
  }
  const { settings, lock } = model;
  const editable = view.kind === 'ready' && model.canEditSettings && !saving;
  const hasTeam = settings.reviewers.some((entry) => entry.type === 'team');
  const getLockHint = () => {
    if (lock.kind !== 'ready') {
      return t('message.ontology-review-lock-unavailable');
    }
    if (!lock.value.inReview) {
      return undefined;
    }

    return t('message.ontology-review-settings-locked', {
      version:
        lock.value.inReview.semanticVersion ??
        t('label.ontology-release-revision', {
          revision: lock.value.inReview.releaseRevision,
        }),
    });
  };
  const lockHint = getLockHint();
  const ruleOptions = [
    { id: OntologyApprovalRule.AnyReviewer, label: t('label.any-one') },
    { id: OntologyApprovalRule.AllReviewers, label: t('label.all') },
  ];
  const statusById = new Map(
    model.assignees.map(({ assignee, status }) => [assignee.id, status])
  );
  // Reviewers of the open review come from its assignees; otherwise the configured ones.
  const people = model.assignees.length
    ? model.assignees.map(({ assignee }) => assignee)
    : settings.reviewers;
  const removeReviewer = (id: string) =>
    void save({
      ...settings,
      reviewers: settings.reviewers.filter((entry) => entry.id !== id),
    });
  const renderReviewers = () =>
    people.length > 0 ? (
      <ul
        aria-label={t('label.reviewers')}
        className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0"
        data-testid="ontology-release-reviewer-list">
        {people.map((person) => {
          const name = getEntityName(person);
          const status = statusById.get(person.id);
          const canRemove =
            editable &&
            !status &&
            settings.reviewers.some((entry) => entry.id === person.id);

          return (
            <li key={person.id}>
              <Box align="center" gap={2}>
                <Avatar initials={name.slice(0, 2).toUpperCase()} size="xs" />
                <Typography
                  className="tw:min-w-0 tw:flex-1 tw:truncate"
                  size="text-sm">
                  {name}
                </Typography>
                {status ? (
                  <Badge color={ASSIGNEE_COLORS[status]} size="sm">
                    {t(`label.${status.toLowerCase()}`)}
                  </Badge>
                ) : null}
                {canRemove ? (
                  <ButtonUtility
                    aria-label={t('label.remove-entity', { entity: name })}
                    color="tertiary"
                    icon={XClose}
                    size="xs"
                    tooltip={t('label.remove')}
                    onClick={() => removeReviewer(person.id)}
                  />
                ) : null}
              </Box>
            </li>
          );
        })}
      </ul>
    ) : (
      <Typography color="secondary" size="text-sm">
        {t('message.ontology-no-reviewers')}
      </Typography>
    );
  const approvalHint = () => {
    if (!settings.reviewers.length) {
      return undefined;
    }
    if (settings.reviewers.length === 1) {
      return t('message.ontology-reviewer-must-approve', {
        name: getEntityName(settings.reviewers[0]),
      });
    }

    return t(
      settings.approvalRule === OntologyApprovalRule.AllReviewers
        ? 'message.ontology-every-reviewer-must-approve'
        : 'message.ontology-any-reviewer-can-approve'
    );
  };
  const renderOutcome = () => (
    <>
      {outcome?.kind === 'conflict' && (
        <Alert variant="warning">
          {t('message.ontology-review-settings-conflict')}
        </Alert>
      )}
      {outcome?.kind === 'unavailable' && (
        <Alert
          rightContent={
            <Button
              color="secondary"
              size="sm"
              onPress={() => void onRefresh()}>
              {t('label.retry')}
            </Button>
          }
          variant="error">
          {t('message.ontology-review-settings-unavailable')}
        </Alert>
      )}
    </>
  );

  // A new pick cannot be the caller or the capture's author; reviewers already configured stay.
  const isEligible = ({ id, name }: EntityReference) =>
    !model.excludedIds.includes(id) &&
    !model.excludedNames.includes(name ?? '');
  const keepsReviewer =
    (current: EntityReference[]) => (entry: EntityReference) =>
      current.some(({ id }) => id === entry.id) || isEligible(entry);
  // One team, or any number of users: the shared picker swaps the selection when the tab changes.
  // Closed while a save is in flight, so a second pick cannot race the first.
  const canPick = interactive && !saving;
  const renderReviewerPicker = () => (
    <Box direction="col" gap={2}>
      <Box>
        <UserTeamSelectableList
          previewSelected
          hasPermission={canPick}
          label={t('label.reviewer-plural')}
          listHeight={200}
          multiple={{ user: true, team: false }}
          owner={settings.reviewers}
          onUpdate={(next = []) =>
            change((latest) => ({
              ...latest,
              reviewers: next.filter(keepsReviewer(latest.reviewers)),
            }))
          }>
          <Button
            color="secondary"
            data-testid="ontology-release-add-reviewer"
            iconLeading={Plus}
            isDisabled={!canPick}
            size="sm">
            {t('label.add-reviewer')}
          </Button>
        </UserTeamSelectableList>
      </Box>
      {lockHint ? (
        <Typography color="secondary" size="text-xs">
          {lockHint}
        </Typography>
      ) : null}
      {lock.kind !== 'ready' && (
        <Button color="secondary" size="sm" onPress={() => void onRefresh()}>
          {t('label.retry')}
        </Button>
      )}
    </Box>
  );

  return (
    <Card data-testid="ontology-release-reviewers" size="sm">
      <Card.Content>
        <Box direction="col" gap={3}>
          <Typography
            as="h3"
            className="not-prose tw:m-0 tw:text-primary"
            size="text-sm"
            weight="semibold">
            {t('label.reviewers')}
          </Typography>
          {renderReviewers()}
          {renderReviewerPicker()}
          <Select
            hint={
              hasTeam ? t('message.ontology-one-team-reviewer') : approvalHint()
            }
            isDisabled={!interactive}
            items={ruleOptions}
            label={t('label.approval-rule')}
            selectedKey={settings.approvalRule}
            tooltip={lockHint}
            onSelectionChange={(key) => {
              const approvalRule = ruleOptions.find(
                (option) => option.id === key
              )?.id;
              if (approvalRule) {
                change((latest) => ({ ...latest, approvalRule }));
              }
            }}>
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select>
          {renderOutcome()}
        </Box>
      </Card.Content>
    </Card>
  );
};

export default OntologyReleaseReviewers;
