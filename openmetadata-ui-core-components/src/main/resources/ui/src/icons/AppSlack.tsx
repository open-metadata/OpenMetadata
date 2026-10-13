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

export const AppSlack: FC<Props> = ({
  size = 24,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <g
      clipPath="url(#app-slack_a)"
      clipRule="evenodd"
      fill="currentColor"
      fillRule="evenodd">
      <path d="M8.004 2.5a1.5 1.5 0 0 0 .001 3h1.497V4a1.5 1.5 0 0 0-1.498-1.5m0 4H4.013c-.828 0-1.498.672-1.497 1.5a1.5 1.5 0 0 0 1.496 1.5h3.992c.828 0 1.498-.672 1.498-1.5s-.67-1.5-1.498-1.5M17.486 8a1.499 1.499 0 1 0-2.996 0v1.5h1.498c.827 0 1.497-.672 1.497-1.5m-3.992 0V4A1.497 1.497 0 1 0 10.5 4v4a1.497 1.497 0 1 0 2.994 0m-1.497 9.5a1.499 1.499 0 0 0 0-2.999H10.5v1.5a1.5 1.5 0 0 0 1.497 1.5m0-4h3.992c.828 0 1.498-.672 1.497-1.5a1.5 1.5 0 0 0-1.496-1.5h-3.992c-.828 0-1.498.672-1.497 1.5-.001.828.669 1.5 1.496 1.5M2.516 12a1.5 1.5 0 0 0 1.497 1.5A1.5 1.5 0 0 0 5.51 12v-1.5H4.013c-.828 0-1.498.672-1.497 1.5m3.992 0v4a1.498 1.498 0 1 0 2.994 0v-4a1.497 1.497 0 1 0-2.994 0" />
    </g>
    <defs>
      <clipPath id="app-slack_a">
        <path d="M2.5 2.5h15v15h-15z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
AppSlack.displayName = 'AppSlack';
