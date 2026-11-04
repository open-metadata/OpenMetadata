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

export const SparkleFilled: FC<Props> = ({
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
      d="m10 2 1.041 4.165c.203.812.305 1.219.516 1.55.188.292.436.54.729.727.33.212.737.314 1.55.517L18 10l-4.165 1.041c-.812.203-1.219.305-1.55.516-.292.188-.54.436-.728.729-.211.33-.313.737-.516 1.55L10 18l-1.041-4.165c-.203-.812-.305-1.219-.517-1.55a2.4 2.4 0 0 0-.728-.728c-.33-.211-.737-.313-1.55-.516L2 10l4.165-1.041c.812-.203 1.219-.305 1.55-.517a2.4 2.4 0 0 0 .727-.728c.212-.33.314-.737.517-1.55z"
      fill="currentColor"
    />
  </svg>
);
SparkleFilled.displayName = 'SparkleFilled';
