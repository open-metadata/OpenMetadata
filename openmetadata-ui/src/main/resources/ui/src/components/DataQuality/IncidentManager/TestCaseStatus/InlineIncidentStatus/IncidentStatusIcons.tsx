/*
 *  Copyright 2023 Collate.
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

import { Check as CheckIcon, XClose as CloseIcon } from '@untitledui/icons';

/** Close (X) — dark icon for secondary/utility surfaces. */
export const BlackCloseIcon = ({ className }: { className?: string }) => (
  <CloseIcon
    className={className}
    style={{ color: 'var(--color-gray-900)', height: 14, width: 14 }}
  />
);

/** Check — white on primary-filled buttons. */
export const WhiteCheckIcon = ({ className }: { className?: string }) => (
  <CheckIcon
    className={className}
    style={{ color: 'var(--color-white)', height: 14, width: 14 }}
  />
);
