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

export const Automator02: FC<Props> = ({
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
      d="M7.346 10.012v1.453c0 .69.56 1.25 1.25 1.25h3.556"
      stroke="currentColor"
      strokeWidth={1.2}
    />
    <path
      d="m10.953 11.215 1.502 1.502-1.502 1.501m2.227-3.476V9.29c0-.69-.56-1.25-1.25-1.25H8.373"
      stroke="currentColor"
      strokeWidth={1.2}
    />
    <path
      d="M9.572 9.542 8.07 8.041l1.502-1.502"
      stroke="currentColor"
      strokeWidth={1.2}
    />
    <path
      d="M11.39 2.894C11.11 2.44 10.663 2 10 2s-1.11.44-1.39.894c-.243.395-.665.732-1.165.939s-1.035.267-1.487.16c-.52-.124-1.146-.119-1.615.35s-.474 1.096-.35 1.615c.107.452.047.988-.16 1.487s-.544.922-.939 1.165C2.44 8.89 2 9.337 2 10s.44 1.11.894 1.39c.395.243.732.665.939 1.165s.267 1.035.16 1.487c-.124.52-.119 1.146.35 1.615.469.468 1.096.474 1.615.35.452-.107.988-.047 1.487.16s.922.544 1.165.939c.28.454.727.894 1.39.894s1.11-.44 1.39-.894c.243-.395.665-.732 1.165-.939s1.035-.267 1.487-.16c.52.124 1.146.118 1.615-.35.468-.469.474-1.096.35-1.615-.107-.452-.047-.988.16-1.487s.544-.922.939-1.165c.454-.28.894-.727.894-1.39s-.44-1.11-.894-1.39c-.395-.243-.732-.665-.939-1.165s-.267-1.035-.16-1.487c.124-.52.118-1.146-.35-1.615-.469-.469-1.096-.474-1.615-.35-.452.107-.988.047-1.487-.16s-.922-.544-1.165-.939Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Automator02.displayName = 'Automator02';
