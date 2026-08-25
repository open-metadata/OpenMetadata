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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const PendingChanges: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="m4.438 7.285-.652-.04c-.673-.04-1.111-.725-.769-1.305a8.06 8.06 0 0 1 9.015-3.664c4.291 1.146 6.84 5.533 5.693 9.799s-5.556 6.795-9.847 5.65A8.03 8.03 0 0 1 2 11.186"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 6.8v2.787a1 1 0 0 0 .293.707L11.6 11.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
PendingChanges.displayName = 'PendingChanges';
