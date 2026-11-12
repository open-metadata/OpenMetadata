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

export const MetadataCompleteness: FC<Props> = ({
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
      d="M10 2 2.889 4.667V10c0 3.911 3.022 7.556 7.11 8 4.09-.444 7.112-4.089 7.112-8V4.667z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m7.5 9.875 1.75 1.75 3.25-3.25"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MetadataCompleteness.displayName = 'MetadataCompleteness';
