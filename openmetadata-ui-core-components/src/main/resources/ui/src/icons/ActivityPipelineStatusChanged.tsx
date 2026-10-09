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

export const ActivityPipelineStatusChanged: FC<Props> = ({
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
      d="M4.847 1.81c.561-.544.842-.815 1.185-.81.343.006.615.286 1.158.847.544.561.815.842.81 1.185s-.286.615-.847 1.158c-.561.544-.842.815-1.185.81-.343-.006-.615-.286-1.158-.847-.544-.561-.815-.842-.81-1.185.006-.343.286-.615.847-1.158ZM3.5 6.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm7.5 0a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0ZM6 5v3.5M4.75 4.25l-1.5 1.5m4-1.5 1.5 1.5m-4 3.95c0-.566 0-.848.176-1.024C5.1 8.5 5.384 8.5 5.95 8.5h.1c.566 0 .849 0 1.024.176.176.175.176.458.176 1.024v.1c0 .566 0 .849-.176 1.024C6.9 11 6.616 11 6.05 11h-.1c-.566 0-.849 0-1.024-.176-.176-.175-.176-.458-.176-1.024z"
      stroke="currentColor"
    />
  </svg>
);
ActivityPipelineStatusChanged.displayName = 'ActivityPipelineStatusChanged';
