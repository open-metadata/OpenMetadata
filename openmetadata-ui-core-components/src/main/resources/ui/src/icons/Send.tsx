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

export const Send: FC<Props> = ({
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
      d="m8.61 4.445 4.82 2.426C16.143 8.236 17.5 8.919 17.5 10s-1.357 1.764-4.07 3.13l-4.82 2.425C5.537 17.102 4 17.875 3.163 17.32a1.7 1.7 0 0 1-.456-.44c-.585-.82.12-2.397 1.531-5.552.27-.601.403-.901.423-1.22a2 2 0 0 0 0-.219c-.02-.318-.154-.618-.423-1.219-1.41-3.155-2.116-4.733-1.53-5.552q.186-.261.455-.44c.837-.555 2.374.22 5.449 1.766M5.086 10h4.912"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Send.displayName = 'Send';
