/*
 *  Copyright 2025 Collate.
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

import { Check } from '@untitledui/icons';
import { cx } from '@/utils/cx';

export interface ToastProps {
  /** The message to display. */
  message: string;
  className?: string;
}

export const Toast = ({ message, className }: ToastProps) => {
  return (
    <div
      className={cx(
        'tw:inline-flex tw:items-center tw:gap-2.5',
        'tw:rounded-[10px] tw:bg-[#181D27] tw:px-4 tw:py-[11px]',
        'tw:text-[13px] tw:font-medium tw:leading-5 tw:text-white',
        'tw:shadow-2xl',
        className
      )}
      role="status">
      <Check
        aria-hidden="true"
        className="tw:size-4 tw:shrink-0 tw:text-[#17B26A]"
      />
      {message}
    </div>
  );
};
