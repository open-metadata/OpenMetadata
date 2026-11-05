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
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  APP_MODE_HINT_STORAGE_KEY,
  APP_MODE_SESSION_KEY,
} from '../../constants/appMode.constants';
import { ROUTES } from '../../constants/constants';
import { PRODUCT_TOUR_STORAGE_KEY } from '../../constants/product-tour/productTour.constants';
import { queryClient } from '../../queryClient';
import {
  activateTourMock,
  deactivateTourMock,
} from '../../rest/product-tour/productTourMock';
import productTourClassBase from '../../utils/ProductTourClassBase';
import { useAppModeStore, writeAppMode } from '../useAppMode';
import { useExploreCache } from '../useExploreCache';

const getSessionStorage = () => sessionStorage;
const getLocalStorage = () => localStorage;

const readStorageItem = (getStorage: () => Storage, key: string) => {
  try {
    return getStorage().getItem(key);
  } catch {
    return null;
  }
};

const restoreStorageItem = (
  getStorage: () => Storage,
  key: string,
  value: string | null
) => {
  try {
    if (value === null) {
      getStorage().removeItem(key);
    } else {
      getStorage().setItem(key, value);
    }
  } catch {
    // Storage unavailable: there is nothing of the tour's to undo either.
  }
};

// React Router numbers its history entries in `history.state.idx`.
const getHistoryIndex = (): number | undefined =>
  (window.history.state as { idx?: number } | null)?.idx;

/** The app mode, and the raw storage that carries it, as the tour found them. */
interface ModeSnapshot {
  mode: string;
  session: string | null;
  hint: string | null;
}

interface ProductTourStore {
  isActive: boolean;
  isEndModalOpen: boolean;
  /** First step of the page the tour is on; react-tour steps within a page itself. */
  stepIndex: number;
  /** The app mode the running tour is in, which picks its definition. */
  tourMode?: string;
  /** The last page outside the tour; `start` keeps it as `returnPath`. */
  lastPath?: string;
  /** Where ending the tour takes the user back to. */
  returnPath?: string;
  /** Set only when the tour switched mode, so exit switches it back. */
  modeBeforeTour?: ModeSnapshot;
  /** History entry of /tour, which the first step replaces. */
  startHistoryIndex?: number;
  recordPath: (path: string) => void;
  start: (currentMode: string) => void;
  goToStep: (stepIndex: number) => void;
  finish: () => void;
  /** Ends the tour, restores the mode, and returns `returnPath`. */
  exit: () => string | undefined;
  /** Puts the cross-tab hint back, for a tab closing mid-tour. */
  restoreModeHint: () => void;
  /** Whether the current history entry is from before the tour started. */
  isBeforeTour: () => boolean;
}

/**
 * Drops what pages visited before the tour cached from the server. Explore's
 * search cache serves its last results at once, so a tour started from
 * Explore would open its Explore step on the server's assets and request
 * their details, which no fixture holds. Queries of mounted components (the
 * shell) are active and stay.
 */
const dropServerDataCachedBeforeTour = () => {
  useExploreCache.getState().clearCache();
  queryClient.removeQueries({ type: 'inactive' });
};

const activateMockFor = (tourMode?: string) => {
  if (tourMode) {
    activateTourMock(productTourClassBase.getTour(tourMode).loadFixtures);
  }
};

/**
 * Tour state lives outside React: a tour in another app mode swaps the whole
 * shell, and remounts everything under it. It is kept in this tab's
 * sessionStorage, so a reload mid-tour resumes the same step on the same
 * fixtures.
 *
 * A tour in another app mode writes that mode into this tab's mode session,
 * so a reload stays in it; the user's remembered preference and the cross-tab
 * hint new tabs read are never written. Exit puts the session tuple and the
 * hint back exactly as they were, or the user's next reload, and their new
 * tabs, would open in it: the hint, in case this tab's heartbeat refreshed it
 * with the tour's mode.
 * ADR:2026-10-23-the-product-tour-serves-its-pages-from-recorded-fixtures
 */
export const useProductTourStore = create<ProductTourStore>()(
  persist(
    (set, get) => ({
      isActive: false,
      isEndModalOpen: false,
      stepIndex: 0,
      tourMode: undefined,
      lastPath: undefined,
      returnPath: undefined,
      modeBeforeTour: undefined,
      startHistoryIndex: undefined,
      recordPath: (path) => {
        const { isActive, isEndModalOpen } = get();
        if (!isActive && !isEndModalOpen && !path.startsWith(ROUTES.TOUR)) {
          set({ lastPath: path });
        }
      },
      start: (currentMode) => {
        // A second /tour while the end modal is up must not record the
        // tour's mode as the one to go back to.
        if (get().isActive || get().isEndModalOpen) {
          return;
        }
        const tour = productTourClassBase.getTour(currentMode);
        const isOtherMode = tour.mode !== currentMode;
        set({
          isActive: true,
          isEndModalOpen: false,
          stepIndex: 0,
          tourMode: tour.mode,
          returnPath: get().lastPath,
          startHistoryIndex: getHistoryIndex(),
          modeBeforeTour: isOtherMode
            ? {
                mode: currentMode,
                session: readStorageItem(
                  getSessionStorage,
                  APP_MODE_SESSION_KEY
                ),
                hint: readStorageItem(
                  getLocalStorage,
                  APP_MODE_HINT_STORAGE_KEY
                ),
              }
            : undefined,
        });
        dropServerDataCachedBeforeTour();
        activateMockFor(tour.mode);
        if (isOtherMode) {
          writeAppMode(tour.mode, undefined, { tabOnly: true });
        }
      },
      goToStep: (stepIndex) => set({ stepIndex }),
      // The mode stays the tour's until the end modal is dismissed: restoring
      // it now would swap the shell out from under the modal.
      finish: () => set({ isActive: false, isEndModalOpen: true }),
      exit: () => {
        const { modeBeforeTour, returnPath } = get();
        set({
          isActive: false,
          isEndModalOpen: false,
          stepIndex: 0,
          tourMode: undefined,
          returnPath: undefined,
          modeBeforeTour: undefined,
          startHistoryIndex: undefined,
        });
        deactivateTourMock();
        if (modeBeforeTour) {
          useAppModeStore.getState().setMode(modeBeforeTour.mode);
          restoreStorageItem(
            getSessionStorage,
            APP_MODE_SESSION_KEY,
            modeBeforeTour.session
          );
          restoreStorageItem(
            getLocalStorage,
            APP_MODE_HINT_STORAGE_KEY,
            modeBeforeTour.hint
          );
        }

        return returnPath;
      },
      restoreModeHint: () => {
        const { modeBeforeTour } = get();
        if (modeBeforeTour) {
          restoreStorageItem(
            getLocalStorage,
            APP_MODE_HINT_STORAGE_KEY,
            modeBeforeTour.hint
          );
        }
      },
      isBeforeTour: () => {
        const { startHistoryIndex } = get();
        const historyIndex = getHistoryIndex();

        return (
          startHistoryIndex !== undefined &&
          historyIndex !== undefined &&
          historyIndex < startHistoryIndex
        );
      },
    }),
    {
      name: PRODUCT_TOUR_STORAGE_KEY,
      storage: createJSONStorage(getSessionStorage),
      partialize: ({
        isActive,
        isEndModalOpen,
        stepIndex,
        tourMode,
        returnPath,
        modeBeforeTour,
        startHistoryIndex,
      }) => ({
        isActive,
        isEndModalOpen,
        stepIndex,
        tourMode,
        returnPath,
        modeBeforeTour,
        startHistoryIndex,
      }),
      // A reload mid-tour must serve the fixtures before the page's first
      // request, so the mock is back on as the store comes back.
      onRehydrateStorage: () => (state) => activateMockFor(state?.tourMode),
    }
  )
);

/** Whether a tour is on screen, its end modal included. */
export const isProductTourRunning = () => {
  const { isActive, isEndModalOpen } = useProductTourStore.getState();

  return isActive || isEndModalOpen;
};
