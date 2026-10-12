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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LogViewerScrollValues,
  ScrollFacts,
  UseLogAutoFollowParams,
  UseLogAutoFollowResult,
} from './LogViewerModal.interface';
import { readScrollFacts } from './LogViewerModal.utils';

/** Keys that move the view back through the log rather than along with it. */
const SCROLL_BACK_KEYS = new Set(['ArrowUp', 'PageUp', 'Home']);

/** Keys that move the view towards the tail — the direction of following. */
const SCROLL_FORWARD_KEYS = new Set(['ArrowDown', 'PageDown', 'End']);

/**
 * How long the viewer's own scrolling stops counting as the user's. Two cases
 * report through `onScroll` indistinguishably from a real scroll: a jump to the
 * tail (the virtualised list lands approximately on a long jump, then corrects)
 * and a wrap/full-screen relayout (re-measuring every row moves both the content
 * height and the offset while the viewer re-pins the tail). A wheel or scroll key
 * closes the window immediately, and anything that keeps pulling away from the
 * tail outruns it (see `UPWARD_MOVES_TO_TAKE_CONTROL`), so the user is never
 * fought for the full duration.
 */
const VIEWER_SCROLL_GRACE_MS = 1000;

/**
 * How long a downward gesture vouches for the scrolls that follow it. Reaching the
 * tail resumes following, but only when the user went there: the library restores
 * its own recorded offset whenever the text changes, and that lands at the tail
 * without anyone asking. A gesture is the same signal used for pausing, so the two
 * directions are decided the same way.
 */
const FORWARD_GESTURE_GRACE_MS = 1500;

/**
 * How many scrolls in a row moving away from the tail take the log back from the
 * viewer's catch-up. This is what covers a scrollbar drag, which reports no wheel
 * and no key — and it needs no pointer event, which native scrollbars do not
 * deliver in every browser and which a plain click would otherwise fake. Two,
 * because a relayout's first report can leave the tail once before the viewer
 * re-pins it.
 */
const UPWARD_MOVES_TO_TAKE_CONTROL = 2;

/**
 * Owns whether a live log is following its tail, and who last moved the view.
 *
 * Every decision here answers one question: did the *user* move the view, or did
 * the *viewer*? `onScroll` reports both identically, so a gesture (wheel, scroll
 * key) is taken as the authoritative signal for pausing — it lands before the next
 * append, whereas a scroll position can be undone by the viewer's own catch-up
 * before the browser reports it. The viewer marks the scrolls it causes (a jump to
 * the tail, a wrap/full-screen relayout) and anything that keeps pulling away from
 * the tail outranks that mark.
 *
 * Following is a live-run concept: a static run has nothing to follow, so the
 * caller keeps honouring its own `follow` prop instead.
 */
export const useLogAutoFollow = ({
  open,
  isLive,
  follow,
  logs,
  bodyRef,
  scrollerLabel,
  scrollToEnd,
}: UseLogAutoFollowParams): UseLogAutoFollowResult => {
  const [followTail, setFollowTail] = useState(isLive || follow);
  // Mirrors `followTail` for the scroll handler. The viewer scrolls itself in the
  // same tick as it resumes following, so the scroll event that comes back would
  // otherwise be read by a closure that still says "paused".
  const followTailRef = useRef(followTail);
  const viewerScrollAtRef = useRef(0);
  const forwardGestureAtRef = useRef(0);
  const lastScrollTopRef = useRef(-1);
  const upwardMovesRef = useRef(0);
  const caughtUpRef = useRef(false);
  const scrollerPreparedRef = useRef(false);

  const setFollow = useCallback((next: boolean) => {
    followTailRef.current = next;
    setFollowTail(next);
  }, []);

  // A run going live, or the modal being reopened, re-pins the view to the tail.
  useEffect(() => {
    lastScrollTopRef.current = -1;
    upwardMovesRef.current = 0;
    setFollow(isLive || follow);
  }, [open, isLive, follow, setFollow]);

  /**
   * Starts following from a view that is already at the tail. Shared by every
   * resume path: whoever gets back to the tail — the toolbar toggle or the user
   * scrolling there — has to grant the catch-up the same grace, or the first
   * append that reports an offset short of the tail reads as the user leaving.
   */
  const beginFollowingFromTail = useCallback(() => {
    upwardMovesRef.current = 0;
    caughtUpRef.current = false;
    viewerScrollAtRef.current = Date.now();
    setFollow(true);
  }, [setFollow]);

  const resumeFollowingTail = useCallback(() => {
    forwardGestureAtRef.current = Date.now();
    beginFollowingFromTail();
    scrollToEnd();
  }, [beginFollowingFromTail, scrollToEnd]);

  const toggleFollow = useCallback(() => {
    if (followTailRef.current) {
      viewerScrollAtRef.current = 0;
      forwardGestureAtRef.current = 0;
      setFollow(false);

      return;
    }

    resumeFollowingTail();
  }, [resumeFollowingTail, setFollow]);

  // Wrapping and full-screen re-measure every row, so the tail moves out from
  // under the current offset. A followed log re-pins itself instead of letting
  // that read as the user taking over.
  const markViewerScroll = useCallback(() => {
    if (followTailRef.current) {
      viewerScrollAtRef.current = Date.now();
    }
  }, []);

  /**
   * Whether this scroll still belongs to the viewer rather than the user.
   */
  const isViewerScroll = useCallback((facts: ScrollFacts) => {
    // The catch-up lands back at the tail between a slow drag's steps. Counting
    // that as "not pulling away" would reset the run every time and a drag the
    // catch-up keeps beating could never outrun the claim.
    const catchUpLanded = facts.isBottom && caughtUpRef.current;
    caughtUpRef.current = false;

    if (facts.movedAwayFromTail) {
      upwardMovesRef.current += 1;
    } else if (!catchUpLanded) {
      upwardMovesRef.current = 0;
    }

    // Something is pulling away from the tail against the catch-up, which the
    // catch-up itself never does — it only ever moves back down.
    if (upwardMovesRef.current >= UPWARD_MOVES_TO_TAKE_CONTROL) {
      viewerScrollAtRef.current = 0;
    }

    return Date.now() - viewerScrollAtRef.current < VIEWER_SCROLL_GRACE_MS;
  }, []);

  /**
   * Scrolling away from the tail hands control back to the user; scrolling back to
   * it resumes following.
   */
  const applyUserScrollIntent = useCallback(
    (facts: ScrollFacts) => {
      if (!facts.isBottom) {
        // A followed log whose offset moved *towards* the tail and stopped short
        // of it is the viewer landing approximately — the library scrolls itself
        // on every append and a virtualised list re-estimates its height as rows
        // are measured. Nobody scrolls down in order to leave the tail, so only a
        // move pulling away from it hands control over.
        if (followTailRef.current && facts.movedTowardsTail) {
          return;
        }

        // Leaving the tail withdraws any earlier request to be at it.
        forwardGestureAtRef.current = 0;
        setFollow(false);

        return;
      }

      // At the tail — but only the user asking to be there resumes following. The
      // library restores its own offset on every text change, which lands here on
      // its own and must not be read as a request to follow again.
      const askedToFollow =
        Date.now() - forwardGestureAtRef.current < FORWARD_GESTURE_GRACE_MS;

      if (askedToFollow) {
        beginFollowingFromTail();
      }
    },
    [beginFollowingFromTail, setFollow]
  );

  const trackScroll = useCallback(
    (scrollValues: LogViewerScrollValues): ScrollFacts => {
      const facts = readScrollFacts(scrollValues, lastScrollTopRef.current);
      lastScrollTopRef.current = scrollValues.scrollTop;

      const viewerOwnsThisScroll = isViewerScroll(facts);

      if (
        followTailRef.current &&
        !facts.isBottom &&
        (!facts.userMovedTheView || viewerOwnsThisScroll)
      ) {
        // Mark it before it happens: the catch-up is a jump, and a long jump
        // reports intermediate offsets on the way that would otherwise read as the
        // user leaving the tail. Fast machines land straight on the bottom and
        // never show them, which is why this only ever failed on CI.
        caughtUpRef.current = true;
        viewerScrollAtRef.current = Date.now();
        scrollToEnd();
      } else if (
        isLive &&
        facts.fillsViewport &&
        facts.userMovedTheView &&
        !viewerOwnsThisScroll
      ) {
        applyUserScrollIntent(facts);
      }

      return facts;
    },
    [isLive, scrollToEnd, isViewerScroll, applyUserScrollIntent]
  );

  // A closed viewer unmounts the log body, so the next open gets a new element to
  // prepare.
  useEffect(() => {
    if (!open) {
      scrollerPreparedRef.current = false;
    }
  }, [open]);

  // The element that actually scrolls is created by the log viewer library, so it
  // has no tab stop of its own: without one the log is pointer-only and the keys
  // below never reach a focused element. Done here rather than in JSX because the
  // scroller is not ours to render.
  //
  // `logs` is a dependency because the scroller does not exist until there is
  // something to scroll, so a first append is what makes it findable. The guard
  // keeps that from costing anything afterwards: searching for it means a
  // `getComputedStyle` on every descendant, which is not something to repeat on
  // each frame of a live run.
  useEffect(() => {
    const body = bodyRef.current;

    if (!open || !isLive || !body || scrollerPreparedRef.current) {
      return;
    }

    const scroller = Array.from(body.querySelectorAll<HTMLElement>('*')).find(
      (element) => {
        const { overflowY } = window.getComputedStyle(element);

        return overflowY === 'auto' || overflowY === 'scroll';
      }
    );

    if (!scroller) {
      return;
    }

    if (!scroller.hasAttribute('tabindex')) {
      scroller.tabIndex = 0;
      scroller.setAttribute('role', 'region');
      scroller.setAttribute('aria-label', scrollerLabel);
    }

    scrollerPreparedRef.current = true;
  }, [open, isLive, logs, bodyRef, scrollerLabel]);

  // Scroll position alone cannot tell the user apart from the viewer: while a
  // stream appends, the viewer's own follow scroll can undo a wheel before the
  // browser reports the new position, so the resulting `onScroll` still reads as
  // "at the tail" and following would never pause. The gesture itself is the
  // only reliable signal, and pausing on it lands before the next append.
  //
  // Deliberately independent of `logs`: the listeners sit on the body, which
  // outlives every append, so there is nothing to rebind when one arrives.
  useEffect(() => {
    const body = bodyRef.current;

    if (!open || !isLive || !body) {
      return;
    }

    const pauseFollow = () => {
      // A real gesture ends the jump grace, so the catch-up in `trackScroll`
      // cannot re-assert the tail on top of the user. It also withdraws any
      // earlier request to be at the tail: without that, a snap-back landing
      // shortly after a resume would be read as still wanting to follow.
      viewerScrollAtRef.current = 0;
      forwardGestureAtRef.current = 0;
      setFollow(false);
    };

    const noteForwardGesture = () => {
      forwardGestureAtRef.current = Date.now();
    };

    const handleWheel = (event: globalThis.WheelEvent) => {
      if (event.deltaY < 0) {
        pauseFollow();
      } else if (event.deltaY > 0) {
        noteForwardGesture();
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (SCROLL_BACK_KEYS.has(event.key)) {
        pauseFollow();
      } else if (SCROLL_FORWARD_KEYS.has(event.key)) {
        noteForwardGesture();
      }
    };

    body.addEventListener('wheel', handleWheel, { passive: true });
    body.addEventListener('keydown', handleKeyDown);

    return () => {
      body.removeEventListener('wheel', handleWheel);
      body.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isLive, bodyRef, setFollow]);

  return {
    followTail,
    trackScroll,
    resumeFollowingTail,
    toggleFollow,
    markViewerScroll,
  };
};
