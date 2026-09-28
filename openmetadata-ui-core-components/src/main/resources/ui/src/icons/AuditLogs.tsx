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
      d="M14.95 7.87V5.563c0-1.266 0-1.899-.246-2.383a2.26 2.26 0 0 0-.988-.987c-.483-.247-1.116-.247-2.382-.247H6.51c-1.266 0-1.899 0-2.382.247a2.26 2.26 0 0 0-.988.987c-.246.484-.246 1.117-.246 2.383v7.836c0 1.266 0 1.899.246 2.382.217.425.562.771.988.988.483.246 1.116.246 2.382.246h.803m3.116-8.288h-4.52m1.507 3.014H5.909m6.028-6.027H5.909"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m17.24 17.946-1.68-1.679m.56-2.797a3.357 3.357 0 1 1-6.713 0 3.357 3.357 0 0 1 6.713 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AuditLogs.displayName = 'AuditLogs';
