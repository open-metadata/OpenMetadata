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

export const AppOnboarding: FC<Props> = ({
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
      d="M8.033 4.12 5.986 5.138C3.33 6.459 2 7.12 2 8.198s1.329 1.74 3.986 3.06l2.047 1.018c.967.481 1.451.722 1.967.722.515 0 .999-.24 1.966-.722l2.047-1.017c2.658-1.322 3.986-1.982 3.986-3.06 0-1.08-1.328-1.74-3.986-3.061L11.966 4.12C11 3.64 10.515 3.398 10 3.398c-.516 0-1 .241-1.967.722"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M5.2 11v3.189c.024.566.336 1.078.824 1.352l.127.065c.264.134.396.201.524.26a7.9 7.9 0 0 0 6.648 0c.128-.059.26-.126.524-.26l.127-.065c.488-.274.8-.787.823-1.352.002-.034.002-.07.002-.143V11M18 8.195v5.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppOnboarding.displayName = 'AppOnboarding';
