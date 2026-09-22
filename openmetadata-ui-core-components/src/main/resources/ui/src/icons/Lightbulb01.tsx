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

export const Lightbulb01: FC<Props> = ({
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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M15 16.5V19c0 .932 0 1.398-.152 1.765a2 2 0 0 1-1.083 1.083C13.398 22 12.932 22 12 22s-1.398 0-1.765-.152a2 2 0 0 1-1.083-1.083C9 20.398 9 19.932 9 19v-2.5m6 0c2.649-1.157 4.5-3.925 4.5-7a7.5 7.5 0 0 0-15 0c0 3.075 1.851 5.843 4.5 7m6 0H9"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Lightbulb01.displayName = 'Lightbulb01';
