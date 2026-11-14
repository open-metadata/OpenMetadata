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
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssigneeStatus } from '../../../../generated/api/data/ontologyReleaseReview';
import { OntologyApprovalRule } from '../../../../generated/entity/data/ontology';
import type {
  ReviewSettings,
  SettingsOutcome,
} from '../../../../hooks/governance/ontology/useOntologyPublication.types';
import { useSettlingReviewEdits } from '../../../../hooks/governance/ontology/useSettlingReviewEdits';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';
import { useUserTeamOptions } from '../../../Glossary/hooks/useEntityReferenceOptions';
import type { ReleasePanelView } from './OntologyReleasePanel.types';

interface OntologyReleaseReviewersProps {
  scopeKey: string;
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
const availableReviewerOptions = (
  options: ReturnType<typeof useUserTeamOptions>['options'],
  model: Extract<ReleasePanelView, { kind: 'ready' }>['value']
) => {
  const { settings } = model;
  if (settings.reviewers.some((entry) => entry.type === 'team')) {
    return [];
  }

  return options.filter(({ value }) => {
    if (settings.reviewers.some((entry) => entry.id === value.id)) {
      return false;
    }
    if (value.type === 'team') {
      return settings.reviewers.length === 0;
    }

    return (
      value.type === 'user' &&
      !model.excludedIds.includes(value.id) &&
      !model.excludedNames.includes(value.name ?? '')
    );
  });
};

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
  scopeKey,
  view,
  onChange,
  onRefresh,
}: OntologyReleaseReviewersProps) => {
  const { t } = useTranslation();
  const search = useUserTeamOptions(scopeKey);
  const onSearchChange = search.onSearchChange;
  const [searchText, setSearchText] = useState('');
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SettingsOutcome>();
  const readEpoch = useRef(0);
  const retained = useRef<ReadyReviewerModel>();
  const model = retainReadableModel(view, retained, readEpoch);
  useEffect(() => {
    if (view.kind === 'unavailable') {
      setSearchText('');
      onSearchChange('');
      setOutcome(undefined);
      setSaving(false);
    }
  }, [view.kind, onSearchChange]);
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
  // Clearing the input after a pick reopens React Aria's list while it still
  // has items, and the pick stays in them until the save returns.
  const options = saving ? [] : availableReviewerOptions(search.options, model);
  const searchUnavailable = [
    search.isFetching,
    search.isPlaceholderData,
    search.error,
  ].some(Boolean);
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
  const searchEmptyState = () => {
    if (search.error) {
      return t('message.ontology-reviewer-search-unavailable');
    }

    return t(searchUnavailable ? 'label.loading' : 'label.no-data-found');
  };
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
        <Alert variant="error">
          {t('message.ontology-review-settings-unavailable')}
          <Button color="secondary" size="sm" onPress={() => void onRefresh()}>
            {t('label.retry')}
          </Button>
        </Alert>
      )}
    </>
  );

  const renderReviewerSearch = () => (
    <>
      <Select.ComboBox
        // Focus opens the list before the first search returns. Closing it then
        // for being empty races text typed right after the focus (Chrome runs
        // the input first), and that text no longer reopens it, so stay open
        // while a search is pending. Not while saving: the pick clears the
        // text and starts a search, which must not reopen the list.
        allowsEmptyCollection={
          !saving && (searchText !== '' || search.isFetching)
        }
        disabledKeys={
          searchUnavailable ? options.map((option) => option.id) : []
        }
        emptyState={searchEmptyState()}
        hint={lockHint}
        inputValue={searchText}
        // The save marks the publication busy, which clears canEditSettings.
        // Disabling the focused input then blurs it, and the focus restored
        // after the save reopens the list over the dialog; stay read-only.
        isDisabled={(!interactive && !saving) || hasTeam}
        isReadOnly={saving}
        items={options}
        label={t('label.add-reviewer')}
        placeholder={t('label.search-or-pick-a-person')}
        selectedKey={null}
        shortcut={false}
        tooltip={lockHint}
        onFocus={search.onFocus}
        onInputChange={(value) => {
          setSearchText(value);
          search.onSearchChange(value);
        }}
        onSelectionChange={(key) => {
          if (!interactive || searchUnavailable) {
            return;
          }
          const selected = options.find((option) => option.id === key);
          if (!selected) {
            return;
          }
          change((latest) => ({
            ...latest,
            reviewers: latest.reviewers.some(
              ({ id }) => id === selected.value.id
            )
              ? latest.reviewers
              : [...latest.reviewers, selected.value],
          }));
          setSearchText('');
          search.onSearchChange('');
        }}>
        {(item) => (
          <Select.Item id={item.id} supportingText={item.supportingText}>
            {item.label}
          </Select.Item>
        )}
      </Select.ComboBox>
      {search.isFetching && <Loader size="small" />}
      {search.error && (
        <Alert variant="error">
          {t('message.ontology-reviewer-search-unavailable')}
          <Button
            color="secondary"
            size="sm"
            onPress={() => void search.refetch()}>
            {t('label.retry')}
          </Button>
        </Alert>
      )}
      {lock.kind !== 'ready' && (
        <Button color="secondary" size="sm" onPress={() => void onRefresh()}>
          {t('label.retry')}
        </Button>
      )}
    </>
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
          {renderReviewerSearch()}
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
