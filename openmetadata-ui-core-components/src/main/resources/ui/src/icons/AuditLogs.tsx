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

export const AuditLogs: FC<Props> = ({
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
      d="M17.158 10.42v-.842c0-3.572 0-5.358-1.11-6.468S13.154 2 9.58 2 4.222 2 3.112 3.11s-1.11 2.896-1.11 6.468 0 5.359 1.11 6.469 2.896 1.11 6.468 1.11l.842-.001M2.424 6.21h14.314M9.58 13.367h.841m-5.052 0h.842M9.58 10h4.21m-8.42 0h.841"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M16.736 16.734 18 17.997m-.842-2.947a2.105 2.105 0 1 0-4.21 0 2.105 2.105 0 0 0 4.21 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AuditLogs.displayName = 'AuditLogs';
