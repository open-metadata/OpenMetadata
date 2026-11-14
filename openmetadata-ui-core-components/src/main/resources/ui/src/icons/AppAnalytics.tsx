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

export const AppAnalytics: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 21 20"
    width={size}
    {...props}>
    <path
      d="M6.944 15.333a1.778 1.778 0 1 0 0-3.556 1.778 1.778 0 0 0 0 3.556m7.111-1.777a1.778 1.778 0 1 0 0-3.556 1.778 1.778 0 0 0 0 3.556m-6.221-2.222 1.131-3.111m1.98-.446 1.778 2.286M14.648 10l1.482-4.445m.593.001a1.778 1.778 0 1 0 0-3.556 1.778 1.778 0 0 0 0 3.556M9.612 8.224a1.778 1.778 0 1 0 0-3.556 1.778 1.778 0 0 0 0 3.556"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M18.5 18H8.722c-2.933 0-4.4 0-5.31-.911-.912-.912-.912-2.378-.912-5.311V2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppAnalytics.displayName = 'AppAnalytics';
