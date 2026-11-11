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

export const ContextCenterFilled: FC<Props> = ({
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
      d="M10 6.2A3.2 3.2 0 0 0 6.8 3H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3.6a2.4 2.4 0 0 1 2.4 2.4m0-11.2v11.2m0-11.2A3.2 3.2 0 0 1 13.2 3H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.6a2.4 2.4 0 0 0-2.4 2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M2 5a2 2 0 0 1 2-2h2.8A3.2 3.2 0 0 1 10 6.2v11.2A2.4 2.4 0 0 0 7.6 15H4a2 2 0 0 1-2-2z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      className="tw:stroke-bg-primary"
      d="M7.12 7H5.2m1.92 3.2H5.2"
      stroke="#fff"
      strokeWidth={1.3}
    />
  </svg>
);
ContextCenterFilled.displayName = 'ContextCenterFilled';
