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
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { Inherit } from '../../../icons/Inherit';

/** Corner badge on an owner avatar marking an owner inherited from a parent
 * entity. Passed to Avatar's `badge` slot, which renders inside the avatar's
 * relatively positioned root. */
export const OwnerInheritedBadge = () => {
  const { t } = useCoreTranslation();

  return (
    <span
      aria-label={t('label.inherited')}
      className="tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:flex tw:size-3 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-secondary tw:bg-primary tw:text-fg-secondary"
      data-testid="inherited-owner-icon"
      role="img">
      <Inherit size={8} />
    </span>
  );
};
