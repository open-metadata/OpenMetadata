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

export const Governance: FC<Props> = ({
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
      d="M2.668 17.09h14.5M2 8.367c0-.547.277-1.057.736-1.355l5.521-3.586a3.2 3.2 0 0 1 3.486 0l5.521 3.586a1.616 1.616 0 0 1-.88 2.971H3.616A1.616 1.616 0 0 1 2 8.367Zm6.4 2.196v6.4m3.2-6.4v6.4m4-6.4v6.4m-11.2-6.4v6.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Governance.displayName = 'Governance';
