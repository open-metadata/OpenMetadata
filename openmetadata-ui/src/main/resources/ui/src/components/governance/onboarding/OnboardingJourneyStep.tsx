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
  ProgressBar,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEqual } from 'lodash';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckType,
  OnboardingStepResult,
} from '../../../generated/governance/onboarding/onboardingProgress';
import {
  describeRule,
  dtypeOf,
  DTYPE_LABEL_KEY,
} from '../../../utils/governance/onboarding/OnboardingField.utils';
import {
  canEditOnboardingField,
  checkRequirementLabel,
  isAssignedToViewer,
  isCheckComplete,
} from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { FieldPathChip } from './CreationCheckBlock';
import { OnboardingAssistance } from './OnboardingAssistance';
import { OnboardingFieldEditor } from './OnboardingFieldEditor';
import { OnboardingHandoffCard } from './OnboardingHandoffCard';
import {
  OnboardingFieldSession,
  OnboardingJourneyProps,
} from './OnboardingJourney.types';

interface Props
  extends Pick<
    OnboardingJourneyProps,
    | 'progress'
    | 'permissions'
    | 'viewer'
    | 'loadField'
    | 'onNudge'
    | 'entityType'
    | 'renderApprovalActions'
  > {
  result: OnboardingStepResult;
  index: number;
  total: number;
  isLast: boolean;
  canSubmit: boolean;
  navigation: ReactNode;
  refreshKey: number;
  resetKey: number;
  onDirtyChange: (dirty: boolean) => void;
  onNext: () => void;
  onSubmit: () => void;
  onGoToOpen: () => void;
}

const checkTitle = (result: OnboardingStepResult) =>
  result.step.title ??
  result.field?.fieldLabel ??
  result.step.fieldPath ??
  result.step.id;

const valueLength = (value: unknown) =>
  typeof value === 'string' ? value.trim().length : 0;

const valueCount = (value: unknown) =>
  Array.isArray(value) ? value.length : 0;

/**
 * How close the answer is to the rule, in the words the design uses: a bar that fills as the
 * producer types, an empty-list nudge, or the rule itself when it is neither.
 */
const StepAnnotation = ({
  result,
  value,
}: {
  result: OnboardingStepResult;
  value: unknown;
}) => {
  const { t } = useTranslation();
  const rules = result.step.rules;
  const rule = describeRule(result.step);

  if (rules?.minLength) {
    const length = valueLength(value);
    const remaining = Math.max(0, rules.minLength - length);

    return (
      <Box align="center" className="tw:mt-2 tw:gap-2">
        <ProgressBar
          aria-label={t(rule.key, { count: rule.count })}
          className="tw:h-1 tw:flex-1"
          max={rules.minLength}
          progressClassName={
            remaining === 0 ? 'tw:bg-fg-success-primary' : undefined
          }
          value={Math.min(length, rules.minLength)}
        />
        <Typography
          className="tw:text-quaternary"
          data-testid="onboarding-rule-progress"
          size="text-xs">
          {remaining === 0
            ? t('label.long-enough')
            : t('message.characters-to-go', { count: remaining })}
        </Typography>
      </Box>
    );
  }

  if (rules?.minItems && valueCount(value) < rules.minItems) {
    return (
      <Typography
        className="tw:mt-2 tw:text-quaternary"
        data-testid="onboarding-rule-progress"
        size="text-xs">
        {t('message.no-items-yet-add-at-least', {
          count: rules.minItems,
          items: t(
            DTYPE_LABEL_KEY[dtypeOf(result.step)] ?? 'label.value-plural'
          ).toLowerCase(),
        })}
      </Typography>
    );
  }

  return (
    <Box
      align="center"
      className="tw:mt-2.5 tw:gap-2 tw:rounded-lg tw:border tw:border-dashed tw:border-primary tw:bg-secondary tw:px-3 tw:py-2.5">
      <Typography
        className="tw:text-tertiary"
        data-testid="onboarding-accepted-when"
        size="text-xs">
        {t('message.accepted-when', {
          rule: t(rule.key, { count: rule.count }),
        })}
      </Typography>
    </Box>
  );
};

/** Whether a save should move the producer on: optional work always does, blocking work only once
 * the server agrees the check is met. */
const shouldAdvance = (
  result: OnboardingStepResult,
  saved?: OnboardingStepResult
) => !result.required || Boolean(saved && isCheckComplete(saved));

const submitLabelKey = (result: OnboardingStepResult) =>
  isCheckComplete(result)
    ? 'label.saved-next-check'
    : 'label.onboarding-save-continue';

/**
 * Whether the viewer can answer this check here and now: it names a field, they may write it, and
 * it is theirs. Fixes the old rule that only offered an editor for `attribute` checks - a
 * relationship or a responsibility is a field on the asset too.
 */
const canAnswerHere = (
  result: OnboardingStepResult,
  permissions: OnboardingJourneyProps['permissions'],
  isPaused: boolean
) =>
  result.step.type !== CheckType.Approval &&
  Boolean(result.field?.fieldPath) &&
  Boolean(result.field && canEditOnboardingField(permissions, result.field)) &&
  !isPaused;

/** What the footer's primary button says, and what it does, at this point in the walk. */
const primaryFor = (
  isLast: boolean,
  canSubmit: boolean,
  actions: { onNext: () => void; onSubmit: () => void; onGoToOpen: () => void }
) => {
  if (!isLast) {
    return { key: 'label.onboarding-next-check', run: actions.onNext };
  }

  return canSubmit
    ? { key: 'label.submit-for-review', run: actions.onSubmit }
    : { key: 'label.go-to-the-open-check', run: actions.onGoToOpen };
};

/** The field was changed elsewhere mid-edit: show what landed and let the producer choose. */
const ConflictPanel = ({
  pending,
  onAccept,
}: {
  pending: OnboardingFieldSession;
  onAccept: (discard: boolean) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box data-testid="onboarding-field-conflict" direction="col" gap={3}>
      <Alert title={t('message.onboarding-field-conflict')} variant="warning" />
      <Typography
        className="tw:break-all tw:whitespace-pre-wrap"
        size="text-sm">
        {typeof pending.value === 'string'
          ? pending.value
          : JSON.stringify(pending.value ?? null, null, 2)}
      </Typography>
      <Box gap={2} wrap="wrap">
        <Button color="secondary" onPress={() => onAccept(true)}>
          {t('label.onboarding-use-saved-value')}
        </Button>
        <Button color="secondary" onPress={() => onAccept(false)}>
          {t('label.onboarding-keep-my-edits')}
        </Button>
      </Box>
    </Box>
  );
};

const LoadErrorPanel = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation();

  return (
    <>
      <Alert
        title={t('message.onboarding-configuration-load-error')}
        variant="error"
      />
      <Button color="secondary" onPress={onRetry}>
        {t('label.retry')}
      </Button>
    </>
  );
};

/**
 * The control that answers the check, the assistance offered for it, and the rule it is measured
 * against - all reading the same live value, so the counter moves as the producer types.
 */
const EditorWorkspace = ({
  result,
  session,
  permissions,
  entityType,
  domain,
  isDisabled,
  onDirtyChange,
  onSaved,
  children,
}: {
  result: OnboardingStepResult;
  session: OnboardingFieldSession;
  permissions: OnboardingJourneyProps['permissions'];
  entityType: OnboardingJourneyProps['entityType'];
  domain?: string;
  isDisabled: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (saved?: OnboardingStepResult) => void;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const [live, setLive] = useState<unknown>(session.value);
  const [applied, setApplied] = useState<unknown>();
  const [appliedKey, setAppliedKey] = useState(0);
  const field = result.field;
  if (!field) {
    return null;
  }

  return (
    <>
      <OnboardingAssistance
        domain={domain}
        entityType={entityType}
        fieldPath={field.fieldPath}
        step={result.step}
        value={live}
        onApply={(value) => {
          setApplied(value);
          setLive(value);
          setAppliedKey((key) => key + 1);
        }}
      />
      <OnboardingFieldEditor
        annotation={<StepAnnotation result={result} value={live} />}
        field={field}
        isDisabled={isDisabled}
        key={appliedKey}
        permissions={permissions}
        properties={session.properties}
        submitLabel={t(submitLabelKey(result))}
        value={applied ?? session.value}
        onDirtyChange={onDirtyChange}
        onSave={async (value) => {
          const saved = await session.save(value);
          setApplied(undefined);
          onSaved(saved);
        }}
        onValueChange={setLive}>
        {children}
      </OnboardingFieldEditor>
    </>
  );
};

/**
 * The editor for one check, with the conflict handling the producer needs when the same field is
 * edited elsewhere while they are typing: the saved value is shown rather than silently applied.
 */
const JourneyEditor = ({
  result,
  loadField,
  next,
  children,
  onDirtyChange,
  refreshKey,
  permissions,
  domain,
  entityType,
}: {
  entityType: OnboardingJourneyProps['entityType'];
  permissions: OnboardingJourneyProps['permissions'];
  refreshKey: number;
  onDirtyChange: (dirty: boolean) => void;
  result: OnboardingStepResult;
  loadField: OnboardingJourneyProps['loadField'];
  next: () => void;
  children: ReactNode;
  domain?: string;
}) => {
  const { t } = useTranslation();
  const [session, setSession] = useState<OnboardingFieldSession>();
  const [error, setError] = useState(false);
  const [pendingSession, setPendingSession] =
    useState<OnboardingFieldSession>();
  const [editorKey, setEditorKey] = useState(0);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const currentSession = useRef<OnboardingFieldSession>();
  const dirty = useRef(false);
  const reportDirty = useCallback(
    (value: boolean) => {
      dirty.current = value;
      onDirtyChange(value);
    },
    [onDirtyChange]
  );
  const path = result.field?.fieldPath;
  useEffect(() => {
    let active = true;
    if (!path) {
      return;
    }
    setLoading(true);
    setError(false);
    loadField(path)
      .then((value) => {
        if (active) {
          if (
            dirty.current &&
            currentSession.current &&
            !isEqual(value.value, currentSession.current.value)
          ) {
            setPendingSession(value);
          } else {
            currentSession.current = value;
            setSession(value);
            setPendingSession(undefined);
            if (!dirty.current) {
              setEditorKey((key) => key + 1);
            }
          }
        }
      })
      .catch((error) => {
        if (active) {
          setError(true);
          showErrorToast(error as AxiosError);
        }
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [path, loadField, refreshKey, retry]);
  const acceptSession = (discard: boolean) => {
    if (!pendingSession) {
      return;
    }
    currentSession.current = pendingSession;
    setSession(pendingSession);
    setPendingSession(undefined);
    if (discard) {
      reportDirty(false);
      setEditorKey((key) => key + 1);
    }
  };

  return (
    <Box direction="col" gap={3}>
      {error && (
        <LoadErrorPanel onRetry={() => setRetry((value) => value + 1)} />
      )}
      {loading && <Typography size="text-sm">{t('label.loading')}</Typography>}
      {pendingSession && (
        <ConflictPanel pending={pendingSession} onAccept={acceptSession} />
      )}
      {session && (
        <EditorWorkspace
          domain={domain}
          entityType={entityType}
          isDisabled={loading || error || Boolean(pendingSession)}
          key={editorKey}
          permissions={permissions}
          result={result}
          session={session}
          onDirtyChange={reportDirty}
          onSaved={(saved) => {
            reportDirty(false);
            if (shouldAdvance(result, saved)) {
              next();
            }
          }}>
          {children}
        </EditorWorkspace>
      )}
    </Box>
  );
};

/**
 * One check, presented as a step: what is being asked, why, the control that answers it, and the
 * one thing to do next. A check owned by another role shows the same frame with a handoff instead
 * of an editor, so the producer always knows where a check stands rather than only their own.
 */
export const OnboardingJourneyStep = ({
  result,
  index,
  total,
  isLast,
  canSubmit,
  navigation,
  progress,
  permissions,
  viewer,
  loadField,
  onNudge,
  entityType,
  renderApprovalActions,
  refreshKey,
  resetKey,
  onDirtyChange,
  onNext,
  onSubmit,
  onGoToOpen,
}: Props) => {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  const [editing, setEditing] = useState(false);
  const id = result.step.id;
  useEffect(() => {
    heading.current?.focus();
  }, [id]);
  const assigned = editing || isAssignedToViewer(result, viewer);
  const editable = canAnswerHere(result, permissions, Boolean(progress.paused));
  const showEditor = editable && assigned;
  const primary = primaryFor(isLast, canSubmit, {
    onGoToOpen,
    onNext,
    onSubmit,
  });

  return (
    <Card
      className="tw:min-w-0 tw:w-full tw:flex-1"
      data-testid="onboarding-journey-step"
      variant="elevated">
      <Card.Header
        subtitle={result.step.guidance}
        title={
          <Box className="tw:gap-2" direction="col">
            <Typography
              className="tw:uppercase tw:tracking-wide tw:text-brand-secondary"
              data-testid="onboarding-step-eyebrow"
              size="text-xs"
              weight="semibold">
              {t('message.step-of-total-requirement', {
                current: index + 1,
                requirement: t(checkRequirementLabel(result)).toLowerCase(),
                total,
              })}
            </Typography>
            <h3
              className="tw:m-0 tw:text-xl tw:font-semibold tw:text-primary"
              ref={heading}
              tabIndex={-1}>
              {checkTitle(result)}
            </h3>
          </Box>
        }
      />
      <Card.Content>
        <Box direction="col" gap={4}>
          <Box aria-live="polite" direction="col" gap={1}>
            {result.message && (
              <Typography className="tw:text-tertiary" size="text-sm">
                {result.message}
              </Typography>
            )}
          </Box>
          {showEditor ? (
            <Box direction="col" gap={2}>
              <Box align="center" className="tw:gap-2" wrap="wrap">
                <Typography size="text-xs" weight="semibold">
                  {t('label.value-for-this-field')}
                </Typography>
                <FieldPathChip fieldPath={result.field?.fieldPath ?? ''} />
              </Box>
              <JourneyEditor
                domain={progress.domains?.[0]?.fullyQualifiedName}
                entityType={entityType}
                key={resetKey}
                loadField={loadField}
                next={onNext}
                permissions={permissions}
                refreshKey={refreshKey}
                result={result}
                onDirtyChange={onDirtyChange}>
                {navigation}
                {isLast && (
                  <Button
                    color="secondary"
                    data-testid="onboarding-step-primary"
                    onPress={primary.run}>
                    {t(primary.key)}
                  </Button>
                )}
              </JourneyEditor>
            </Box>
          ) : (
            <>
              <OnboardingHandoffCard result={result} onNudge={onNudge}>
                {renderApprovalActions?.(result)}
              </OnboardingHandoffCard>
              <Box gap={2} justify="end" wrap="wrap">
                {navigation}
                {editable && !assigned && (
                  <Button color="secondary" onPress={() => setEditing(true)}>
                    {t('label.edit')}
                  </Button>
                )}
                <Button
                  data-testid="onboarding-step-primary"
                  onPress={primary.run}>
                  {t(primary.key)}
                </Button>
              </Box>
            </>
          )}
          {!result.required && (
            <Typography className="tw:text-quaternary" size="text-xs">
              {t('message.optional-does-not-hold-up-review')}
            </Typography>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
};
