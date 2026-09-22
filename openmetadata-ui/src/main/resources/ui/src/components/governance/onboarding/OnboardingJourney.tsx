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
import { Alert, Box, Button } from '@openmetadata/ui-core-components';
import { ArrowLeft } from '@openmetadata/ui-core-components/icons';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useInRouterContext } from 'react-router-dom';
import {
  canSubmitForReview,
  isCheckComplete,
  journeyInitialStep,
  journeySteps,
} from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import { NavigationGuardModal } from '../../common/NavigationGuardModal/NavigationGuardModal';
import {
  OnboardingJourneyHandle,
  OnboardingJourneyProps,
} from './OnboardingJourney.types';
import { OnboardingJourneyHeader } from './OnboardingJourneyHeader';
import { OnboardingJourneyRail } from './OnboardingJourneyRail';
import { OnboardingJourneyStep } from './OnboardingJourneyStep';
import { OnboardingJourneySubmitted } from './OnboardingJourneySubmitted';
import { OnboardingNavigationGuard } from './OnboardingNavigationGuard';

/**
 * The producer's guided setup: what this asset still needs before it can go to review, one check at
 * a time. The list is the playbook's - the wizard only decides the order the producer meets it in,
 * and never lets them lose an edit by moving on.
 */
export const OnboardingJourney = forwardRef<
  OnboardingJourneyHandle,
  OnboardingJourneyProps
>((props, ref) => {
  const {
    progress,
    viewer,
    refresh,
    playbook,
    initialStepId,
    justSubmitted,
    includeCompletedHistory,
  } = props;
  const { t } = useTranslation();
  const steps = useMemo(
    () => (includeCompletedHistory ? progress.steps : journeySteps(progress)),
    [progress, includeCompletedHistory]
  );
  const [selectedId, setSelectedId] = useState(() => {
    const requested = initialStepId
      ? steps.find((result) => result.step.id === initialStepId)?.step.id
      : undefined;

    return (
      requested ??
      (progress.completed ? undefined : journeyInitialStep(steps, viewer))
    );
  });
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
  const index = steps.findIndex((result) => result.step.id === selectedId);
  const selected = steps[index];
  const firstOpen = steps.find(
    (result) => result.required && !isCheckComplete(result)
  );
  const next = () => {
    const following = steps[index + 1];
    if (following) {
      select(following.step.id);
    } else if (firstOpen && firstOpen.step.id !== selectedId) {
      select(firstOpen.step.id);
    }
  };
  const back = () => select(steps[index - 1]?.step.id);
  const advance = async () =>
    confirmNavigation(() => {
      void props.advance();
    });
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
          {t('label.skip-for-now')}
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
      <OnboardingJourneyHeader
        advance={advance}
        busy={props.busy}
        permissions={props.permissions}
        playbook={playbook}
        progress={progress}
        renderApprovalActions={props.renderApprovalActions}
        steps={steps}
        viewer={viewer}
      />
      {progress.paused && (
        <Alert title={t('message.onboarding-paused')} variant="warning" />
      )}
      {progress.completed && (
        <Alert
          title={t('message.onboarding-approved-complete')}
          variant="success"
        />
      )}
      {justSubmitted ? (
        <OnboardingJourneySubmitted
          entityType={props.entityType}
          playbook={playbook}
          progress={progress}
          submittedStage={props.submittedStage}
          viewer={viewer}
        />
      ) : (
        <Box align="start" className="tw:flex-col tw:lg:flex-row" gap={5}>
          <OnboardingJourneyRail
            playbook={playbook}
            selectedId={selectedId}
            steps={steps}
            viewer={viewer}
            onRefresh={async () => {
              await refresh();
              setRefreshKey((key) => key + 1);
            }}
            onSelect={select}
          />
          {selected && (
            <OnboardingJourneyStep
              canSubmit={canSubmitForReview(progress)}
              entityType={props.entityType}
              index={index}
              isLast={index === steps.length - 1}
              key={selectedId}
              loadField={props.loadField}
              navigation={navigation}
              permissions={props.permissions}
              progress={progress}
              refreshKey={refreshKey}
              renderApprovalActions={props.renderApprovalActions}
              resetKey={resetKey}
              result={selected}
              total={steps.length}
              viewer={viewer}
              onDirtyChange={onDirtyChange}
              onGoToOpen={() => firstOpen && select(firstOpen.step.id)}
              onNext={next}
              onNudge={props.onNudge}
              onSubmit={advance}
            />
          )}
        </Box>
      )}
    </Box>
  );
});
OnboardingJourney.displayName = 'OnboardingJourney';
