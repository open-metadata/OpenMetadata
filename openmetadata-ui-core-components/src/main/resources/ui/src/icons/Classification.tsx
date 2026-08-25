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

export const Classification: FC<Props> = ({
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
      d="M6.8 6h7c1.685 0 2.528 0 3.133.405.262.175.487.4.663.662.404.606.404 1.448.404 3.134 0 2.809 0 4.213-.674 5.222a4 4 0 0 1-1.104 1.104c-1.009.674-2.413.674-5.222.674h-1c-3.771 0-5.657 0-6.828-1.172S2 12.972 2 9.201V6.756c0-1.453 0-2.18.304-2.725a2.4 2.4 0 0 1 .926-.926c.546-.304 1.272-.304 2.725-.304.931 0 1.397 0 1.804.153.93.348 1.314 1.194 1.734 2.033L10 6.001"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M8.005 12.4a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4m.858-.271 2.639 2.57"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Classification.displayName = 'Classification';
