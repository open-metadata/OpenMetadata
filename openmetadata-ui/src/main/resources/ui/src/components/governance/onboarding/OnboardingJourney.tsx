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
  Card,
  ProgressBarCircle,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Users01,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isEqual } from 'lodash';
import {
  forwardRef,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useInRouterContext } from 'react-router-dom';
import {
  OnboardingStepResult,
  Type,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  ONBOARDING_STAGES,
  STAGE_LABELS,
} from '../../../utils/governance/onboarding/Onboarding.utils';
import {
  assigneeInitials,
  blockingProgress,
  canEditOnboardingField,
  canRequestTransition,
  checkRequirementLabel,
  checkStateColor,
  groupJourneySteps,
  isAssignedToViewer,
  isCheckComplete,
  journeyInitialStep,
} from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { getWorkflowDefinitionDetailPath } from '../../../utils/WorkflowRouterUtils';
import { NavigationGuardModal } from '../../common/NavigationGuardModal/NavigationGuardModal';
import { OnboardingFieldEditor } from './OnboardingFieldEditor';
import {
  OnboardingFieldSession,
  OnboardingJourneyHandle,
  OnboardingJourneyProps,
} from './OnboardingJourney.types';
import { OnboardingNavigationGuard } from './OnboardingNavigationGuard';

const checkTitle = (result: OnboardingStepResult) =>
  result.step.title ??
  result.field?.fieldLabel ??
  result.step.fieldPath ??
  result.step.id;

const JourneyNavigation = ({
  title,
  steps,
  selected,
  select,
}: {
  title: string;
  steps: OnboardingStepResult[];
  selected?: string;
  select: (id: string) => void;
}) => {
  const { t } = useTranslation();
  if (!steps.length) {
    return null;
  }

  return (
    <nav aria-label={t(title)}>
      <Typography
        className="tw:px-3 tw:py-2 tw:text-tertiary"
        size="text-xs"
        weight="semibold">
        {t(title)}
      </Typography>
      <ol className="tw:m-0 tw:list-none tw:space-y-1 tw:p-0">
        {steps.map((result) => (
          <li key={result.step.id}>
            <Button
              aria-current={selected === result.step.id ? 'step' : undefined}
              aria-label={checkTitle(result)}
              className="tw:h-auto tw:w-full tw:justify-start tw:whitespace-normal tw:py-3 tw:text-left"
              color={selected === result.step.id ? 'secondary' : 'tertiary'}
              iconLeading={isCheckComplete(result) ? CheckCircle : Clock}
              onPress={() => select(result.step.id)}>
              <Box direction="col" gap={1}>
                <Typography size="text-sm" weight="semibold">
                  {checkTitle(result)}
                </Typography>
                <Box gap={2} wrap="wrap">
                  <Badge color={checkStateColor(result.state)} size="sm">
                    {t(`label.onboarding-state-${result.state.toLowerCase()}`)}
                  </Badge>
                  <Typography className="tw:text-tertiary" size="text-xs">
                    {t(checkRequirementLabel(result))}
                  </Typography>
                </Box>
              </Box>
            </Button>
          </li>
        ))}
      </ol>
    </nav>
  );
};

const JourneyHandoff = ({
  result,
  children,
}: {
  result: OnboardingStepResult;
  children?: ReactNode;
}) => {
  const { t } = useTranslation();
  const workflow = result.step.workflow;

  return (
    <Card
      color={isCheckComplete(result) ? 'success' : 'warning'}
      data-testid="onboarding-handoff">
      <Card.Header
        title={t(
          result.step.type === Type.Approval
            ? 'label.onboarding-workflow-review'
            : 'label.onboarding-handoff'
        )}
      />
      <Card.Content>
        <Box direction="col" gap={4}>
          <Typography size="text-sm">
            {t(
              result.assignees?.length
                ? 'message.onboarding-handoff-help'
                : 'message.onboarding-unassigned-help'
            )}
          </Typography>
          <Box direction="col" gap={2}>
            {result.assignees?.map((assignee) => (
              <Box align="center" gap={2} key={assignee.id}>
                <Avatar
                  alt={getEntityName(assignee)}
                  initials={assigneeInitials(getEntityName(assignee))}
                  size="sm"
                />
                <Typography size="text-sm" weight="semibold">
                  {getEntityName(assignee)}
                </Typography>
                {assignee.type === 'team' && (
                  <Badge color="gray">{t('label.team')}</Badge>
                )}
              </Box>
            ))}
          </Box>
          <Box align="center" gap={2} wrap="wrap">
            <Badge color={checkStateColor(result.state)}>
              {t(`label.onboarding-state-${result.state.toLowerCase()}`)}
            </Badge>
            {result.taskId && (
              <Button color="secondary" href={`/tasks/${result.taskId}`}>
                {t('label.view-task')}
              </Button>
            )}
            {workflow?.fullyQualifiedName && (
              <Button
                color="link-color"
                href={getWorkflowDefinitionDetailPath(
                  workflow.fullyQualifiedName
                )}>
                {getEntityName(workflow)}
              </Button>
            )}
          </Box>
          {result.step.type === Type.Approval && (
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('message.onboarding-workflow-assignment')}
            </Typography>
          )}
          {result.workflowInstanceId && (
            <Typography
              className="tw:break-all tw:text-tertiary"
              size="text-xs">
              {t('message.onboarding-workflow-evidence', {
                id: result.workflowInstanceId,
              })}
            </Typography>
          )}
          {children}
        </Box>
      </Card.Content>
    </Card>
  );
};

const JourneyEditor = ({
  result,
  loadField,
  next,
  children,
  onDirtyChange,
  refreshKey,
  permissions,
}: {
  permissions: OnboardingJourneyProps['permissions'];
  refreshKey: number;
  onDirtyChange: (dirty: boolean) => void;
  result: OnboardingStepResult;
  loadField: OnboardingJourneyProps['loadField'];
  next: () => void;
  children: ReactNode;
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
        <>
          <Alert
            title={t('message.onboarding-configuration-load-error')}
            variant="error"
          />
          <Button
            color="secondary"
            onPress={() => setRetry((value) => value + 1)}>
            {t('label.retry')}
          </Button>
        </>
      )}
      {loading && <Typography size="text-sm">{t('label.loading')}</Typography>}
      {pendingSession && (
        <Box data-testid="onboarding-field-conflict" direction="col" gap={3}>
          <Alert
            title={t('message.onboarding-field-conflict')}
            variant="warning"
          />
          <Typography
            className="tw:break-all tw:whitespace-pre-wrap"
            size="text-sm">
            {typeof pendingSession.value === 'string'
              ? pendingSession.value
              : JSON.stringify(pendingSession.value ?? null, null, 2)}
          </Typography>
          <Box gap={2} wrap="wrap">
            <Button color="secondary" onPress={() => acceptSession(true)}>
              {t('label.onboarding-use-saved-value')}
            </Button>
            <Button color="secondary" onPress={() => acceptSession(false)}>
              {t('label.onboarding-keep-my-edits')}
            </Button>
          </Box>
        </Box>
      )}
      {session && result.field && (
        <OnboardingFieldEditor
          field={result.field}
          isDisabled={loading || error || Boolean(pendingSession)}
          key={editorKey}
          permissions={permissions}
          properties={session.properties}
          submitLabel={t('label.onboarding-save-continue')}
          value={session.value}
          onDirtyChange={reportDirty}
          onSave={async (value) => {
            const saved = await session.save(value);
            reportDirty(false);
            if (!result.required || (saved && isCheckComplete(saved))) {
              next();
            }
          }}>
          {children}
        </OnboardingFieldEditor>
      )}
    </Box>
  );
};

type JourneyGroups = ReturnType<typeof groupJourneySteps>;

const JourneyAdvance = ({
  progress,
  permissions,
  advance,
  busy,
  renderApprovalActions,
}: Pick<
  OnboardingJourneyProps,
  'progress' | 'permissions' | 'advance' | 'busy' | 'renderApprovalActions'
>) => {
  const { t } = useTranslation();
  if (progress.completed) {
    return null;
  }
  const allowed = renderApprovalActions
    ? progress.canAdvance
    : canRequestTransition(progress);
  const editable = permissions.All || permissions.EditAll;
  const nextStage = ONBOARDING_STAGES.find(
    (stage) => String(stage) === progress.nextStatus
  );

  return (
    <Button
      data-testid="onboarding-advance"
      isDisabled={!allowed || !editable}
      isLoading={busy}
      onPress={advance}>
      {progress.canAdvance
        ? t('label.advance-to-stage', {
            stage: nextStage ? t(STAGE_LABELS[nextStage]) : progress.nextStatus,
          })
        : t('label.request-onboarding-transition')}
    </Button>
  );
};

const JourneySummary = ({
  groups,
  ...props
}: OnboardingJourneyProps & { groups: JourneyGroups }) => {
  const { t } = useTranslation();
  const mine = groups.mine.filter((result) => result.required);
  const personalComplete = mine.filter(isCheckComplete).length;
  const othersOpen = [...groups.others, ...groups.unassigned].filter(
    (result) => result.required && !isCheckComplete(result)
  ).length;

  return (
    <Box direction="col" gap={4}>
      <Box align="center" gap={4} justify="between" wrap="wrap">
        <Box align="center" gap={3}>
          <ProgressBarCircle
            label={t('label.onboarding-your-checks')}
            max={Math.max(mine.length, 1)}
            size="xxs"
            value={mine.length ? personalComplete : 1}
          />
          <Box direction="col" gap={1}>
            <Typography size="text-sm" weight="semibold">
              {t('message.onboarding-personal-progress', {
                complete: personalComplete,
                total: mine.length,
              })}
            </Typography>
            <Typography className="tw:text-tertiary" size="text-sm">
              {t(
                othersOpen
                  ? 'message.onboarding-others-open'
                  : 'message.onboarding-others-clear',
                { count: othersOpen }
              )}
            </Typography>
          </Box>
        </Box>
        <JourneyAdvance {...props} />
      </Box>
      {props.progress.paused && (
        <Alert title={t('message.onboarding-paused')} variant="warning" />
      )}
      {props.progress.completed && (
        <Alert
          title={t('message.onboarding-approved-complete')}
          variant="success"
        />
      )}
    </Box>
  );
};

const JourneyStepHeading = ({
  result,
  index,
  total,
}: {
  result: OnboardingStepResult;
  index: number;
  total: number;
}) => {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  const id = result.step.id;
  useEffect(() => {
    heading.current?.focus();
  }, [id]);

  return (
    <Box direction="col" gap={3}>
      <Box align="center" gap={2} wrap="wrap">
        <Typography
          className="tw:text-brand-secondary"
          size="text-xs"
          weight="semibold">
          {t('message.onboarding-step-position', { current: index + 1, total })}
        </Typography>
        <Badge color="gray">{t(checkRequirementLabel(result))}</Badge>
        {result.stage && (
          <Badge color="gray">{t(STAGE_LABELS[result.stage])}</Badge>
        )}
      </Box>
      <h3
        className="tw:m-0 tw:text-xl tw:font-semibold tw:text-primary"
        ref={heading}
        tabIndex={-1}>
        {checkTitle(result)}
      </h3>
      {result.step.guidance && (
        <Typography className="tw:text-tertiary" size="text-sm">
          {result.step.guidance}
        </Typography>
      )}
      <Box aria-live="polite" direction="col" gap={1}>
        {result.message && (
          <Typography className="tw:text-tertiary" size="text-sm">
            {result.message}
          </Typography>
        )}
        {result.step.rules?.minLength && (
          <Typography className="tw:text-tertiary" size="text-xs">
            {t('message.onboarding-minimum-length', {
              count: result.step.rules.minLength,
            })}
          </Typography>
        )}
        {result.step.rules?.minItems && (
          <Typography className="tw:text-tertiary" size="text-xs">
            {t('message.onboarding-minimum-count', {
              count: result.step.rules.minItems,
            })}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

const JourneyDetail = ({
  result,
  index,
  next,
  navigation,
  onDirtyChange,
  refreshKey,
  resetKey,
  ...props
}: OnboardingJourneyProps & {
  result: OnboardingStepResult;
  index: number;
  next: () => void;
  navigation: ReactNode;
  onDirtyChange: (dirty: boolean) => void;
  refreshKey: number;
  resetKey: number;
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const editable =
    result.field &&
    canEditOnboardingField(props.permissions, result.field) &&
    !props.progress.paused;
  const assigned = editing || isAssignedToViewer(result, props.viewer);
  const showEditor = result.step.type === Type.Field && editable && assigned;

  return (
    <Card className="tw:min-w-0 tw:w-full tw:flex-1" variant="elevated">
      <Card.Content>
        <Box direction="col" gap={4}>
          <JourneyStepHeading
            index={index}
            result={result}
            total={props.progress.steps.length}
          />
          {showEditor ? (
            <JourneyEditor
              key={resetKey}
              loadField={props.loadField}
              next={next}
              permissions={props.permissions}
              refreshKey={refreshKey}
              result={result}
              onDirtyChange={onDirtyChange}>
              {navigation}
            </JourneyEditor>
          ) : (
            <>
              <JourneyHandoff result={result}>
                {props.renderApprovalActions?.(result)}
              </JourneyHandoff>
              <Box gap={2} justify="end" wrap="wrap">
                {navigation}
                {editable && (
                  <Button
                    color="secondary"
                    iconLeading={Users01}
                    onPress={() => setEditing(true)}>
                    {t('label.edit')}
                  </Button>
                )}
                <Button
                  color="secondary"
                  iconTrailing={ArrowRight}
                  isDisabled={index === props.progress.steps.length - 1}
                  onPress={next}>
                  {t('label.onboarding-next-check')}
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
};

const JourneyFinished = ({
  progress,
}: Pick<OnboardingJourneyProps, 'progress'>) => {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  const counts = blockingProgress(progress.steps);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <Card className="tw:w-full tw:min-w-0 tw:flex-1" color="success">
      <Card.Content>
        <Box align="center" direction="col" gap={4}>
          <ProgressBarCircle
            label={t('label.required')}
            max={Math.max(counts.total, 1)}
            size="xs"
            value={counts.total ? counts.complete : 1}
          />
          <h3
            className="tw:m-0 tw:text-lg tw:font-semibold tw:text-primary"
            ref={heading}
            tabIndex={-1}>
            {t('message.onboarding-progress-count', counts)}
          </h3>
        </Box>
      </Card.Content>
    </Card>
  );
};

export const OnboardingJourney = forwardRef<
  OnboardingJourneyHandle,
  OnboardingJourneyProps
>((props, ref) => {
  const { progress, viewer, refresh } = props;
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(() =>
    progress.completed ? undefined : journeyInitialStep(progress.steps, viewer)
  );
  const dirty = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ run: () => void }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const inRouter = useInRouterContext();
  const onDirtyChange = useCallback((value: boolean) => {
    dirty.current = value;
    setIsDirty(value);
  }, []);
  const confirmNavigation = useCallback((action: () => void) => {
    if (dirty.current) {
      setPendingAction({ run: action });
    } else {
      action();
    }
  }, []);
  useImperativeHandle(
    ref,
    () => ({ confirmNavigation, isDirty: () => dirty.current }),
    [confirmNavigation]
  );
  const select = (id?: string) => {
    if (id !== selectedId) {
      confirmNavigation(() => setSelectedId(id));
    }
  };
  const groups = useMemo(
    () => groupJourneySteps(progress.steps, viewer),
    [progress.steps, viewer]
  );
  const selected = progress.steps.find(
    (result) => result.step.id === selectedId
  );
  const index = progress.steps.findIndex(
    (result) => result.step.id === selectedId
  );
  const next = () => {
    const following = progress.steps[index + 1];
    if (following) {
      select(following.step.id);
    } else {
      select(
        progress.steps.find(
          (result) =>
            result.step.id !== selectedId &&
            result.required &&
            !isCheckComplete(result)
        )?.step.id
      );
    }
  };
  const back = () => {
    select(progress.steps[index - 1]?.step.id);
  };
  const navigation = (
    <>
      <Button
        color="tertiary"
        iconLeading={ArrowLeft}
        isDisabled={index <= 0}
        onPress={back}>
        {t('label.back')}
      </Button>
      {selected && !selected.required && (
        <Button color="tertiary" onPress={next}>
          {t('label.skip')}
        </Button>
      )}
    </>
  );

  return (
    <Box data-testid="onboarding-journey" direction="col" gap={5}>
      <NavigationGuardModal
        isOpen={Boolean(pendingAction)}
        onLeave={() => {
          onDirtyChange(false);
          setResetKey((key) => key + 1);
          pendingAction?.run();
          setPendingAction(undefined);
        }}
        onStay={() => setPendingAction(undefined)}
      />
      {inRouter && <OnboardingNavigationGuard dirty={isDirty} />}
      <JourneySummary
        {...props}
        advance={async () =>
          confirmNavigation(() => {
            void props.advance();
          })
        }
        groups={groups}
      />
      <Box align="start" className="tw:flex-col tw:lg:flex-row" gap={5}>
        <Card className="tw:w-full tw:lg:w-80 tw:lg:shrink-0" size="sm">
          <Card.Header
            subtitle={
              progress.configurationVersion === undefined
                ? undefined
                : t('message.onboarding-pinned-version', {
                    version: progress.configurationVersion,
                  })
            }
            title={t(STAGE_LABELS[progress.stage])}
          />
          <Card.Content>
            <Box direction="col" gap={3}>
              <JourneyNavigation
                select={select}
                selected={selectedId}
                steps={groups.mine}
                title="label.onboarding-your-checks"
              />
              <JourneyNavigation
                select={select}
                selected={selectedId}
                steps={groups.others}
                title="label.onboarding-others-checks"
              />
              <JourneyNavigation
                select={select}
                selected={selectedId}
                steps={groups.unassigned}
                title="label.onboarding-unassigned-checks"
              />
            </Box>
          </Card.Content>
          <Card.Footer>
            <Button
              color="link-gray"
              onPress={async () => {
                await refresh();
                setRefreshKey((key) => key + 1);
              }}>
              {t('label.refresh')}
            </Button>
          </Card.Footer>
        </Card>
        {selected ? (
          <JourneyDetail
            {...props}
            index={index}
            key={selectedId}
            navigation={navigation}
            next={next}
            refreshKey={refreshKey}
            resetKey={resetKey}
            result={selected}
            onDirtyChange={onDirtyChange}
          />
        ) : (
          <JourneyFinished progress={progress} />
        )}
      </Box>
    </Box>
  );
});
OnboardingJourney.displayName = 'OnboardingJourney';
