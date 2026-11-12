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

export const Webhook: FC<Props> = ({
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
      d="M3.833 10.89a3.556 3.556 0 1 0 5.278 3.111h5.333"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m10 6 2.717 4.891a3.556 3.556 0 1 1-.495 5.884"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 6.891a.889.889 0 1 0 0-1.778m0 1.778a.889.889 0 0 1 0-1.778m0 1.778V5.113m-4.445 9.778a.889.889 0 0 0 0-1.778m0 1.778a.889.889 0 0 1 0-1.778m0 1.778v-1.778m8.889 1.778a.889.889 0 0 0 0-1.778m0 1.778a.889.889 0 1 1 0-1.778m0 1.778v-1.778"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.555 6a3.556 3.556 0 1 0-5.283 3.11L5.555 14"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Webhook.displayName = 'Webhook';
