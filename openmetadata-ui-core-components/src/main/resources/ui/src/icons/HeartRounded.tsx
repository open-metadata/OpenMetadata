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

export const HeartRounded: FC<Props> = ({
  size = 20,
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
      d="M13.426 2.5c2.935 0 4.907 2.794 4.907 5.4 0 5.278-8.185 9.6-8.333 9.6s-8.333-4.322-8.333-9.6c0-2.607 1.972-5.4 4.907-5.4 1.684 0 2.787.853 3.426 1.603.639-.75 1.741-1.603 3.426-1.603"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
HeartRounded.displayName = 'HeartRounded';
