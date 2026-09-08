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

import { ReactNode } from 'react';

/**
 * Wraps tooltip text so a long entity name stays fully readable.
 *
 * The core Tooltip caps its bubble at `max-w-xs` (320px). Its default
 * `overflow-wrap: break-word` only breaks at existing opportunities, so an
 * unbroken name (`GlobalEnterpriseCustomer...`) has no break point, overflows
 * the bubble, and gets visually clipped - defeating the point of the tooltip.
 * `anywhere` adds break opportunities inside the token so the name wraps.
 */
export const renderBreakableTooltip = (text?: ReactNode): ReactNode => (
  <span className="tw:block tw:max-w-full tw:[overflow-wrap:anywhere]">
    {text}
  </span>
);
