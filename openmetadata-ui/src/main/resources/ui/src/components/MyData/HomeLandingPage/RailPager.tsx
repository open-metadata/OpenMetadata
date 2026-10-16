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
import { useTranslation } from 'react-i18next';
import type { RailScrollState } from './useRailPager';

// Pager circle, matching the mock: a 28px button with a 10px glyph.
const PAGER_BUTTON_CLASSES = 'tw:rounded-full';

export interface RailPagerProps {
  /** Prefixes the buttons' test ids: `<prefix>-previous`, `<prefix>-next`. */
  testIdPrefix: string;
  canScroll: RailScrollState;
  onPrevious: () => void;
  onNext: () => void;
}

/** Previous / next for a Home page rail, read as one control. */
const RailPager = ({
  testIdPrefix,
  canScroll,
  onPrevious,
  onNext,
}: RailPagerProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:items-center tw:gap-2">
      {/* Icons are passed as components, not elements, so ButtonUtility
      tags them `data-icon` and its own xs sizing applies. */}
      <ButtonUtility
        className={PAGER_BUTTON_CLASSES}
        color="secondary"
        data-testid={`${testIdPrefix}-previous`}
        icon={ChevronLeft}
        isDisabled={!canScroll.previous}
        size="xs"
        tooltip={t('label.previous')}
        onClick={onPrevious}
      />
      <ButtonUtility
        className={PAGER_BUTTON_CLASSES}
        color="secondary"
        data-testid={`${testIdPrefix}-next`}
        icon={ChevronRight}
        isDisabled={!canScroll.next}
        size="xs"
        tooltip={t('label.next')}
        onClick={onNext}
      />
    </div>
  );
};

export default RailPager;
