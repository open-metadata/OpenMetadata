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
  Card,
  Select,
  Tag,
  TagGroup,
  TagList,
  Typography,
} from '@openmetadata/ui-core-components';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssigneeStatus } from '../../../../generated/api/data/ontologyReleaseReview';
import { OntologyApprovalRule } from '../../../../generated/entity/data/ontology';
import type {
  ReviewSettings,
  SettingsOutcome,
} from '../../../../hooks/governance/ontology/useOntologyPublication.types';
import { getEntityName } from '../../../../utils/EntityNameUtils';
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
  if (!model) {
    return view.kind === 'loading' ? (
      <Typography role="status">{t('label.loading')}</Typography>
    ) : (
      <Alert variant="error">
        {t('message.ontology-review-settings-unavailable')}
      </Alert>
    );
  }
  const { settings, lock } = model;
  const editable = view.kind === 'ready' && model.canEditSettings && !saving;
  const hasTeam = settings.reviewers.some((entry) => entry.type === 'team');
  const options = availableReviewerOptions(search.options, model);
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
  const save = async (next: ReviewSettings) => {
    if (!editable) {
      return;
    }
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

  const renderAssignees = () =>
    model.assignees.length > 0 && (
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0">
        {model.assignees.map(({ assignee, status }) => (
          <li key={assignee.id}>
            <Box gap={2} justify="between">
              <Typography size="text-sm">{getEntityName(assignee)}</Typography>
              <Badge color={ASSIGNEE_COLORS[status]}>
                {t(`label.${status.toLowerCase()}`)}
              </Badge>
            </Box>
          </li>
        ))}
      </ul>
    );
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
        disabledKeys={
          searchUnavailable ? options.map((option) => option.id) : []
        }
        emptyState={searchEmptyState()}
        hint={lockHint}
        inputValue={searchText}
        isDisabled={!editable || hasTeam}
        items={options}
        label={t('label.add-reviewer')}
        selectedKey={null}
        tooltip={lockHint}
        onFocus={search.onFocus}
        onInputChange={(value) => {
          setSearchText(value);
          search.onSearchChange(value);
        }}
        onSelectionChange={(key) => {
          if (!editable || searchUnavailable) {
            return;
          }
          const selected = options.find((option) => option.id === key);
          if (!selected) {
            return;
          }
          void save({
            ...settings,
            reviewers: [...settings.reviewers, selected.value],
          });
          setSearchText('');
          search.onSearchChange('');
        }}>
        {(item) => (
          <Select.Item id={item.id} supportingText={item.supportingText}>
            {item.label}
          </Select.Item>
        )}
      </Select.ComboBox>
      {search.isFetching && (
        <Typography role="status" size="text-sm">
          {t('label.loading')}
        </Typography>
      )}
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
          <Typography as="h3" size="text-sm" weight="semibold">
            {t('label.reviewers')}
          </Typography>
          <TagGroup
            disabledKeys={
              editable ? [] : settings.reviewers.map((entry) => entry.id)
            }
            label={t('label.reviewers')}
            onRemove={
              editable
                ? (keys) =>
                    void save({
                      ...settings,
                      reviewers: settings.reviewers.filter(
                        (entry) => !keys.has(entry.id)
                      ),
                    })
                : undefined
            }>
            <TagList items={settings.reviewers}>
              {(entry) => <Tag id={entry.id}>{getEntityName(entry)}</Tag>}
            </TagList>
          </TagGroup>
          {settings.reviewers.length === 0 && (
            <Typography color="secondary" size="text-sm">
              {t('message.ontology-no-reviewers')}
            </Typography>
          )}
          {renderReviewerSearch()}
          <Select
            hint={hasTeam ? t('message.ontology-one-team-reviewer') : undefined}
            isDisabled={!editable}
            items={ruleOptions}
            label={t('label.approval-rule')}
            selectedKey={settings.approvalRule}
            tooltip={lockHint}
            onSelectionChange={(key) => {
              const approvalRule = ruleOptions.find(
                (option) => option.id === key
              )?.id;
              if (approvalRule) {
                void save({ ...settings, approvalRule });
              }
            }}>
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select>
          {renderAssignees()}
          {renderOutcome()}
        </Box>
      </Card.Content>
    </Card>
  );
};

export default OntologyReleaseReviewers;
