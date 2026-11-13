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

export const MetadataCompletenessFilled: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M10 2.5 3.335 5v5c0 3.667 2.833 7.083 6.667 7.5 3.833-.417 6.666-3.833 6.666-7.5V5z"
      fill="currentColor"
    />
    <path
      d="M10 2.5 3.335 5v5c0 3.667 2.833 7.083 6.667 7.5 3.833-.417 6.666-3.833 6.666-7.5V5z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      className="tw:stroke-bg-primary"
      d="m7.223 10.276 1.944 1.944 3.611-3.61"
      stroke="#fff"
      strokeWidth={1.3}
    />
  </svg>
);
MetadataCompletenessFilled.displayName = 'MetadataCompletenessFilled';
