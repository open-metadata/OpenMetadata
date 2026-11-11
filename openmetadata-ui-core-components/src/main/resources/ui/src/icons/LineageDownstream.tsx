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

export const LineageDownstream: FC<Props> = ({
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
      d="M5.2 2h9.6A3.2 3.2 0 0 1 18 5.2v9.6a3.2 3.2 0 0 1-3.2 3.2H5.2A3.2 3.2 0 0 1 2 14.8V5.2A3.2 3.2 0 0 1 5.2 2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m15 12.5-3.934-3.934c-.198-.198-.297-.297-.412-.334a.5.5 0 0 0-.309 0c-.114.037-.213.136-.41.334l-1.37 1.368c-.197.198-.296.297-.41.334a.5.5 0 0 1-.31 0c-.114-.037-.213-.136-.41-.334L5 7.5M15 9v3.5h-3.5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LineageDownstream.displayName = 'LineageDownstream';
