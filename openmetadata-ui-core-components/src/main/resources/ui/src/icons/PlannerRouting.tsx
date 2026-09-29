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

export const PlannerRouting: FC<Props> = ({
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
      d="M15.376 8.972a.835.835 0 0 1-1.15 0c-1.411-1.347-3.303-2.851-2.38-5.035C12.344 2.756 13.542 2 14.802 2s2.457.756 2.956 1.937c.921 2.181-.966 3.693-2.382 5.035"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.91 5.2h-.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0M4.4 18a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8M9.203 6h-1.2c-1.546 0-2.8 1.075-2.8 2.4 0 1.326 1.254 2.4 2.8 2.4h2.4c1.547 0 2.8 1.074 2.8 2.4s-1.253 2.4-2.8 2.4h-1.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.91 5.2h-.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
PlannerRouting.displayName = 'PlannerRouting';
