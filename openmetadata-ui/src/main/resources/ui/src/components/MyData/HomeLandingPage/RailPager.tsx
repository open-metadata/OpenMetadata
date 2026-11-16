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
import { ButtonUtility } from '@openmetadata/ui-core-components';
import {
  ChevronLeft,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import { useLayoutEffect, useRef, type FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { RailScrollState } from '../../../hooks/useRailPager';
import {
  OPPOSITE_PAGER_SIDE,
  PAGER_BUTTON_CLASSES,
  type RailPagerSide,
} from './RailPager.constants';

export interface RailPagerProps {
  /** Prefixes the buttons' test ids: `<prefix>-previous`, `<prefix>-next`. */
  testIdPrefix: string;
  canScroll: RailScrollState;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * Previous / next for a Home page rail, read as one control. Each button is
 * disabled at its end of the rail; when that happens to the focused one, focus
 * moves to the other button rather than falling to the page.
 */
const RailPager = ({
  testIdPrefix,
  canScroll,
  onPrevious,
  onNext,
}: RailPagerProps) => {
  const { t } = useTranslation();
  const pagerRef = useRef<HTMLDivElement>(null);
  // Survives the blur that disabling the button causes, so the effect below
  // still knows which side held focus.
  const focusedSideRef = useRef<RailPagerSide | null>(null);

  const handleFocus = (side: RailPagerSide) => () => {
    focusedSideRef.current = side;
  };
  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.disabled) {
      focusedSideRef.current = null;
    }
  };

  // Layout effect, so focus moves before the disabled button is painted.
  useLayoutEffect(() => {
    const side = focusedSideRef.current;
    if (!side) {
      return;
    }
    const pager = pagerRef.current;
    const active = document.activeElement;
    const opposite = OPPOSITE_PAGER_SIDE[side];
    // Only reclaim focus the disabled button dropped, never focus the user has
    // since moved elsewhere.
    const isFocusDropped =
      !active || active === document.body || Boolean(pager?.contains(active));
    const shouldHandOff =
      isFocusDropped && !canScroll[side] && canScroll[opposite];
    if (shouldHandOff) {
      pager
        ?.querySelector<HTMLButtonElement>(`[data-pager-side="${opposite}"]`)
        ?.focus();
    }
  }, [canScroll]);

  return (
    <div className="tw:flex tw:items-center tw:gap-2" ref={pagerRef}>
      {/* Icons are passed as components, not elements, so ButtonUtility
      tags them `data-icon` and its own sizing applies. */}
      <ButtonUtility
        className={PAGER_BUTTON_CLASSES}
        color="secondary"
        data-pager-side="previous"
        data-testid={`${testIdPrefix}-previous`}
        icon={ChevronLeft}
        isDisabled={!canScroll.previous}
        size="sm"
        tooltip={t('label.previous')}
        onBlur={handleBlur}
        onClick={onPrevious}
        onFocus={handleFocus('previous')}
      />
      <ButtonUtility
        className={PAGER_BUTTON_CLASSES}
        color="secondary"
        data-pager-side="next"
        data-testid={`${testIdPrefix}-next`}
        icon={ChevronRight}
        isDisabled={!canScroll.next}
        size="sm"
        tooltip={t('label.next')}
        onBlur={handleBlur}
        onClick={onNext}
        onFocus={handleFocus('next')}
      />
    </div>
  );
};

export default RailPager;
