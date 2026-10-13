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

export const Calendar02: FC<Props> = ({
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
      d="M17.2 8.4H2.8M13.2 2v3.2M6.8 2v3.2m2 6.4 1.2-.8v4m-1 0h2M6.64 18h6.72c1.345 0 2.017 0 2.53-.262a2.4 2.4 0 0 0 1.05-1.048c.26-.514.26-1.186.26-2.53V7.44c0-1.344 0-2.016-.26-2.53a2.4 2.4 0 0 0-1.05-1.048c-.513-.262-1.185-.262-2.53-.262H6.64c-1.343 0-2.015 0-2.529.262A2.4 2.4 0 0 0 3.062 4.91c-.261.514-.261 1.186-.261 2.53v6.72c0 1.344 0 2.016.261 2.53a2.4 2.4 0 0 0 1.05 1.048C4.624 18 5.296 18 6.64 18"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Calendar02.displayName = 'Calendar02';
