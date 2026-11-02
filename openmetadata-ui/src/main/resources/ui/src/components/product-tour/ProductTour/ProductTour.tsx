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
import type { ReactProps } from '@deuex-solutions/react-tour';
import {
  Button,
  SimpleModal,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import {
  ComponentType,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { useProductTourStore } from '../../../hooks/product-tour/useProductTourStore';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { isTourPageQuiet } from '../../../rest/product-tour/productTourMock';
import brandClassBase from '../../../utils/BrandData/BrandClassBase';
import { getPathNameFromWindowLocation } from '../../../utils/LocationUtils';
import {
  getTourStepIndexForPath,
  onVisiblePage,
} from '../../../utils/product-tour/productTour.utils';
import productTourClassBase from '../../../utils/ProductTourClassBase';
import productTourPagesClassBase from '../../AppRouter/ProductTourPagesClassBase';
import ProductTourPathRecorder from '../ProductTourPathRecorder/ProductTourPathRecorder';
import ProductTourStepContent from '../ProductTourStepContent/ProductTourStepContent';
import {
  KEYBOARD_NAVIGATION_ESCAPE_ONLY,
  TARGET_POLL_INTERVAL_MS,
  TOUR_FALLBACK_ATTRIBUTE,
  TOUR_HELPER_CLASS_NAME,
  TOUR_HELPER_MARKER_CLASS_NAME,
  TOUR_IN_VIEW_THRESHOLD,
  TOUR_MASK_COLOR,
  TOUR_PAGE_QUIET_MS,
  TOUR_PENDING_ATTRIBUTE,
  TOUR_STEP_WAIT_MS,
} from './ProductTour.constants';
import {
  focusTourNextButton,
  getTourTarget,
  leaveTour,
  releaseTourPageLock,
  runInViewTransition,
  scrollTargetIntoView,
  waitForStableTarget,
} from './ProductTour.utils';

// The package's typings leave out `className` (the popover's) and `startAt`,
// and declare `disableKeyboardNavigation` a boolean though it also takes the
// keys to disable.
type ReactTutorialProps = Omit<ReactProps, 'disableKeyboardNavigation'> & {
  className?: string;
  startAt?: number;
  disableKeyboardNavigation: boolean | typeof KEYBOARD_NAVIGATION_ESCAPE_ONLY;
};

// Lazy: the UMD bundle only matters while a tour is running. It calls a global
// `regeneratorRuntime` it does not ship, which only some other pages happen to
// load, so the tour loads it first. Vite's dev pre-bundle hands back the whole
// `module.exports`, so the component sits one `default` deeper there.
const ReactTutorial = lazy(async () => {
  await import('regenerator-runtime/runtime');
  const { default: tourExport } = await import('@deuex-solutions/react-tour');
  const { default: nestedExport } = tourExport as unknown as {
    default?: typeof tourExport;
  };

  return {
    default: (nestedExport ?? tourExport) as ComponentType<ReactTutorialProps>,
  };
});

/**
 * Runs the product tour. Mounted once above both app shells, so it outlives
 * the route changes, and the mode switch, the tour makes.
 *
 * react-tour can only step between targets already on the page, so the tour
 * is played a page at a time: crossing to a step on another route records it
 * in the store, unmounts react-tour, navigates, waits for the new target, and
 * mounts react-tour again starting at that step.
 *
 * The browser's Back and Forward buttons move the tour to the page they land
 * on, or end it on a page that is not on the tour or that came before it.
 *
 * The end modal is rendered here too, so the last step's popover is gone
 * before it opens.
 */
const ProductTour = () => {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    isActive,
    isEndModalOpen,
    stepIndex,
    tourMode,
    goToStep,
    finish,
    exit,
    restoreModeHint,
    isBeforeTour,
  } = useProductTourStore();
  const [readyStepIndex, setReadyStepIndex] = useState<number>();
  const { svg: BrandMonogram } = brandClassBase.getMonogram();
  const steps = useMemo(
    () =>
      tourMode
        ? productTourClassBase.getTour(tourMode).steps.map(onVisiblePage)
        : [],
    [tourMode]
  );
  const pageSelector = productTourClassBase.getPageSelector();
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const navigatedStepRef = useRef<number>();
  // Resolves the page change in progress once its step is on screen.
  const stepShownRef = useRef<() => void>();
  const isTutorialShown = isActive && readyStepIndex !== undefined;
  const isTourOpen = isActive || isEndModalOpen;

  useEffect(() => {
    setReadyStepIndex(undefined);
    if (!isActive || !step) {
      navigatedStepRef.current = undefined;

      return;
    }
    // Navigate once per step. A page may redirect on arrival (a bare
    // /glossary opens its first glossary), and chasing the step's own path
    // again would bounce between the two forever.
    if (navigatedStepRef.current !== stepIndex) {
      navigatedStepRef.current = stepIndex;
      if (pathname !== step.route) {
        // /tour only launches the tour, so Back from the first step returns
        // to the page the tour was started from rather than restarting it.
        navigate(step.route, { replace: pathname === ROUTES.TOUR });

        return;
      }
    }

    return waitForStableTarget(
      step.selector,
      () => setReadyStepIndex(stepIndex),
      () => isTourPageQuiet(TOUR_PAGE_QUIET_MS)
    );
  }, [isActive, stepIndex, pathname, step, navigate]);

  // Also on /tour itself, which only launches the tour: its route loads behind
  // the mask rather than showing a loader before the tour starts.
  const isPagePending =
    (isActive && !isTutorialShown) || pathname === ROUTES.TOUR;

  // The page renders hidden until it settles; see TOUR_PENDING_ATTRIBUTE.
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute(
      TOUR_PENDING_ATTRIBUTE,
      isPagePending
    );

    return () =>
      document.documentElement.removeAttribute(TOUR_PENDING_ATTRIBUTE);
  }, [isPagePending]);

  // Load every page the tour visits up front, so none waits on its code.
  useEffect(() => {
    if (isActive && tourMode) {
      productTourPagesClassBase.preloadPages(tourMode).catch(() => undefined);
    }
  }, [isActive, tourMode]);

  // The tour's own moves are pushes; a popstate is the browser's Back or
  // Forward, so the tour follows it to that page's step, or ends: on a page
  // that is not on the tour, or on one from before it started, even if the
  // tour visits that page too.
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const handlePopState = () => {
      const index = isBeforeTour()
        ? -1
        : getTourStepIndexForPath(steps, getPathNameFromWindowLocation());
      if (index === -1) {
        exit();
        leaveTour();

        return;
      }
      navigatedStepRef.current = index;
      goToStep(index);
    };
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [isActive, steps, goToStep, exit, isBeforeTour]);

  // A tab closed mid-tour must not leave the tour's mode hint for new tabs.
  useEffect(() => {
    if (!isTourOpen) {
      return;
    }
    window.addEventListener('pagehide', restoreModeHint);

    return () => window.removeEventListener('pagehide', restoreModeHint);
  }, [isTourOpen, restoreModeHint]);

  // A step is on screen once react-tour has placed its popover; the page
  // change waiting on it can then cross-fade to it.
  useEffect(() => {
    if (!isTutorialShown) {
      return;
    }
    // A timer, as in waitForStableTarget: no animation frames run while the
    // view transition holds the previous step.
    let pollId = 0;
    const resolveWhenPlaced = () => {
      const helper = document.querySelector(
        `.${TOUR_HELPER_MARKER_CLASS_NAME}`
      );
      if (helper && helper.getBoundingClientRect().width > 0) {
        stepShownRef.current?.();
        stepShownRef.current = undefined;
      } else {
        pollId = window.setTimeout(resolveWhenPlaced, TARGET_POLL_INTERVAL_MS);
      }
    };
    resolveWhenPlaced();

    return () => window.clearTimeout(pollId);
  }, [isTutorialShown, readyStepIndex]);

  const changePage = useCallback(
    (index: number) =>
      runInViewTransition(
        () => goToStep(index),
        new Promise<void>((resolve) => {
          stepShownRef.current = resolve;
        })
      ),
    [goToStep]
  );

  // Layout cleanup, so the lock is gone before the end modal applies its own.
  useLayoutEffect(() => {
    if (!isTutorialShown) {
      return;
    }

    return () => {
      releaseTourPageLock();
      document.documentElement.removeAttribute(TOUR_FALLBACK_ATTRIBUTE);
    };
  }, [isTutorialShown]);

  const tourSteps = useMemo(
    () =>
      steps.map((tourPageStep, index) => {
        const next = steps[index + 1];
        const prev = steps[index - 1];
        const tourStep = {
          content: <ProductTourStepContent {...tourPageStep} />,
          selector: tourPageStep.selector,
          position: tourPageStep.position,
          stepInteraction: false,
          // react-tour closes the whole tour when a step's target is missing
          // as it opens, and reads the step it passes here right after, so
          // this is where a missing target is swapped for the page.
          beforeStep: () => {
            tourStep.selector = getTourTarget(
              tourPageStep.selector,
              pageSelector
            );
            const isFallback = tourStep.selector !== tourPageStep.selector;
            tourStep.position = isFallback ? undefined : tourPageStep.position;
            document.documentElement.toggleAttribute(
              TOUR_FALLBACK_ATTRIBUTE,
              isFallback
            );
            scrollTargetIntoView(tourStep.selector);
            focusTourNextButton();
          },
          beforeNext:
            next && next.route !== tourPageStep.route
              ? () => changePage(index + 1)
              : undefined,
          beforePrev:
            prev && prev.route !== tourPageStep.route
              ? () => changePage(index - 1)
              : undefined,
        };

        return tourStep;
      }),
    [steps, changePage, pageSelector]
  );

  // Closing early goes back to where the tour was started from. react-tour's
  // close button calls both onRequestClose and onRequestSkip, so only the
  // first call ends the tour.
  const handleClose = useCallback(() => {
    const { isActive: isRunning, isEndModalOpen: isEnding } =
      useProductTourStore.getState();
    if (isRunning || isEnding) {
      leaveTour(exit() ?? ROUTES.HOME);
    }
  }, [exit]);

  const handleExploreNow = useCallback(() => {
    exit();
    leaveTour(ROUTES.HOME);
  }, [exit]);

  return (
    <>
      <ProductTourPathRecorder />

      {/* The tour's mask, held while the next page settles, so moving between
          pages reads as one tour rather than a page loading. */}
      {isPagePending && (
        <div
          aria-busy
          aria-label={t('label.loading')}
          className="tw:fixed tw:inset-0 tw:z-[99999] tw:bg-overlay/70"
          data-testid="tour-step-loading"
          role="status"
        />
      )}

      {isTutorialShown && (
        <Suspense fallback={null}>
          <ReactTutorial
            disableDotsNavigation
            showCloseButton
            showNumber
            accentColor={theme.primaryColor ?? ''}
            className={TOUR_HELPER_CLASS_NAME}
            disableKeyboardNavigation={KEYBOARD_NAVIGATION_ESCAPE_ONLY}
            inViewThreshold={TOUR_IN_VIEW_THRESHOLD}
            key={readyStepIndex}
            lastStepNextButton={
              <Button
                aria-label={t('label.next')}
                color="tertiary"
                data-testid="last-step-button"
                iconLeading={ArrowRight}
                onClick={finish}
              />
            }
            maskColor={TOUR_MASK_COLOR}
            playTour={isActive}
            startAt={readyStepIndex}
            stepWaitTimer={TOUR_STEP_WAIT_MS}
            steps={tourSteps}
            onRequestClose={handleClose}
            onRequestSkip={handleClose}
          />
        </Suspense>
      )}

      <SimpleModal
        data-testid="tour-end-modal"
        footer={
          <Button
            color="primary"
            data-testid="tour-end-explore-now"
            size="md"
            onClick={handleExploreNow}>
            {t('label.explore-now')}
          </Button>
        }
        isDismissable={false}
        isOpen={isEndModalOpen}
        onCancel={handleClose}>
        <div className="tw:flex tw:flex-col tw:items-center tw:gap-5 tw:pt-4 tw:text-center">
          <BrandMonogram
            aria-label={t('label.brand-name-logo', {
              brandName: brandClassBase.getPlatformName(),
            })}
            className="tw:size-[70px] tw:shrink-0"
            role="img"
          />
          <Typography as="p" data-testid="tour-complete-message">
            {t('message.successfully-completed-the-tour')}
            <br />
            {t('message.get-started-with-open-metadata', {
              brandName: brandClassBase.getPlatformName(),
            })}
          </Typography>
        </div>
      </SimpleModal>
    </>
  );
};

export default ProductTour;
