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
import { TARGET_WAIT_TIMEOUT_MS } from '../../../constants/product-tour/productTour.constants';
import { TOUR_HELPER_MARKER_CLASS_NAME } from './ProductTour.constants';
import {
  focusTourNextButton,
  getTourTarget,
  leaveTour,
  releaseTourPageLock,
  runInViewTransition,
  scrollTargetIntoView,
  waitForStableTarget,
} from './ProductTour.utils';

const addTarget = (top: number, height = 40) => {
  const target = document.createElement('div');
  target.id = 'target';
  target.getBoundingClientRect = () =>
    ({ top, bottom: top + height, left: 0, width: 100, height } as DOMRect);
  target.scrollIntoView = jest.fn();
  document.body.appendChild(target);

  return target;
};

jest.mock('../../../utils/HistoryUtils', () => ({
  getBasePath: () => '/om',
}));

describe('ProductTour utils', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  describe('waitForStableTarget', () => {
    it('opens the step once the target has stopped moving', () => {
      jest.useFakeTimers();
      addTarget(100);
      const onReady = jest.fn();

      waitForStableTarget('#target', onReady);
      jest.advanceTimersByTime(200);

      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('waits for the page to settle before opening the step', () => {
      jest.useFakeTimers();
      addTarget(100);
      const onReady = jest.fn();
      let isSettled = false;

      waitForStableTarget('#target', onReady, () => isSettled);
      jest.advanceTimersByTime(200);

      expect(onReady).not.toHaveBeenCalled();

      isSettled = true;
      jest.advanceTimersByTime(200);

      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('still opens the step when the target never appears', () => {
      jest.useFakeTimers();
      const onReady = jest.fn();

      waitForStableTarget('#missing', onReady);
      jest.advanceTimersByTime(TARGET_WAIT_TIMEOUT_MS - 1);

      expect(onReady).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);

      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('does nothing once cancelled', () => {
      jest.useFakeTimers();
      const onReady = jest.fn();

      const cancel = waitForStableTarget('#missing', onReady);
      cancel();
      jest.advanceTimersByTime(TARGET_WAIT_TIMEOUT_MS);

      expect(onReady).not.toHaveBeenCalled();
    });
  });

  describe('scrollTargetIntoView', () => {
    it('scrolls a target whose top is above the viewport', () => {
      const target = addTarget(-50);

      scrollTargetIntoView('#target');

      expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    });

    it('centres a target under a prompt docked at the bottom of the page', () => {
      // jsdom's viewport is 768 px tall.
      const target = addTarget(700);

      scrollTargetIntoView('#target');

      expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    });

    it('leaves a target clear of the viewport edges where it is', () => {
      const target = addTarget(300);

      scrollTargetIntoView('#target');

      expect(target.scrollIntoView).not.toHaveBeenCalled();
    });

    it('leaves a tall target whose top is on screen where it is', () => {
      const target = addTarget(100, 2000);

      scrollTargetIntoView('#target');

      expect(target.scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls a tall target whose top is hidden to the top', () => {
      const target = addTarget(-50, 2000);

      scrollTargetIntoView('#target');

      expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    });
  });

  describe('getTourTarget', () => {
    it('keeps a target that is on the page', () => {
      addTarget(100);

      expect(getTourTarget('#target', '#page')).toBe('#target');
    });

    it('points at the page when the target is gone', () => {
      expect(getTourTarget('#missing', '#page')).toBe('#page');
    });
  });

  it('moves focus to the popover Next button', () => {
    jest.useFakeTimers();
    document.body.innerHTML = `<div class="${TOUR_HELPER_MARKER_CLASS_NAME}"><button data-tour-elem="left-arrow"></button><button data-tour-elem="right-arrow"></button></div>`;

    focusTourNextButton();
    jest.advanceTimersByTime(20);

    expect(document.activeElement).toBe(
      document.querySelector('[data-tour-elem="right-arrow"]')
    );
  });

  it('releases the scroll lock react-tour leaves on <html> and <body>', () => {
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.position = 'relative';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'relative';
    document.body.style.paddingRight = '15px';

    releaseTourPageLock();

    expect(document.documentElement.style.overflow).toBe('');
    expect(document.documentElement.style.position).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.position).toBe('');
    expect(document.body.style.paddingRight).toBe('');
  });

  describe('leaveTour', () => {
    const assign = jest.fn();
    const reload = jest.fn();
    const location = window.location;

    beforeAll(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { assign, reload },
      });
    });

    afterAll(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: location,
      });
    });

    it('loads the given page under the app base path', () => {
      leaveTour('/explore');

      expect(assign).toHaveBeenCalledWith('/om/explore');
    });

    it('reloads where the browser is without a path', () => {
      leaveTour();

      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('runInViewTransition', () => {
    afterEach(() => {
      Reflect.deleteProperty(document, 'startViewTransition');
    });

    it('moves at once where the browser has no view transitions', () => {
      const update = jest.fn();

      runInViewTransition(update, Promise.resolve());

      expect(update).toHaveBeenCalledTimes(1);
    });

    it('holds the current step until the next one is shown', async () => {
      let finishUpdate: Promise<unknown> = Promise.resolve();
      const startViewTransition = jest.fn((callback: () => Promise<void>) => {
        finishUpdate = callback();

        return { ready: Promise.resolve(), finished: Promise.resolve() };
      });
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value: startViewTransition,
      });
      const update = jest.fn();
      let showStep: () => void = () => undefined;
      const isShown = new Promise<void>((resolve) => {
        showStep = resolve;
      });
      let isUpdateDone = false;

      runInViewTransition(update, isShown);
      finishUpdate.then(() => {
        isUpdateDone = true;
      });
      await Promise.resolve();

      expect(update).toHaveBeenCalledTimes(1);
      expect(isUpdateDone).toBe(false);

      showStep();
      await finishUpdate;

      expect(isUpdateDone).toBe(true);
    });
  });
});
