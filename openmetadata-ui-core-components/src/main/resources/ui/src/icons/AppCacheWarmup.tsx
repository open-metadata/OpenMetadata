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

export const AppCacheWarmup: FC<Props> = ({
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
      d="m7.315 2.917-1.363.63C3.85 4.517 2.8 5.003 2.8 5.8s1.05 1.283 3.15 2.254l1.364.63c1.322.611 1.983.917 2.686.917s1.364-.306 2.686-.917l1.364-.63c2.1-.971 3.15-1.457 3.15-2.254s-1.05-1.282-3.15-2.253l-1.364-.63C11.365 2.306 10.704 2 10.001 2s-1.364.306-2.686.917"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.032 9.277c.113.16.17.325.17.507 0 .786-1.05 1.264-3.151 2.221l-1.364.622c-1.322.602-1.983.903-2.686.903s-1.364-.3-2.686-.903l-1.363-.622C3.85 11.048 2.8 10.57 2.8 9.785c0-.183.056-.349.17-.508"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M16.703 13.414c.333.265.499.529.499.841 0 .786-1.05 1.264-3.151 2.222l-1.364.621c-1.322.602-1.983.904-2.686.904s-1.364-.302-2.686-.904l-1.363-.621C3.85 15.519 2.8 15.04 2.8 14.255c0-.312.166-.576.498-.84"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppCacheWarmup.displayName = 'AppCacheWarmup';
