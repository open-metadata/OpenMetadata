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

export const ActivityAssetUpdated: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <path
      d="M4.5 1.862A4.5 4.5 0 0 0 1.062 7M4 3.25l.5-1.388L3 1.25m6.532 7A4.5 4.5 0 0 0 6.25 1.812m2.5 4.938.782 1.5 1.468-1m-9.242 1.5a4.5 4.5 0 0 0 3.742 2 4.48 4.48 0 0 0 3-1.146m-6.742.896V8.75H3.5"
      stroke="currentColor"
    />
  </svg>
);
ActivityAssetUpdated.displayName = 'ActivityAssetUpdated';
