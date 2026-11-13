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

export const AuditReport: FC<Props> = ({
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
      d="M15.6 9.2v-.8c0-3.017 0-4.525-.936-5.463C13.726 2 12.218 2 9.2 2s-4.526 0-5.463.937S2.8 5.383 2.8 8.4v3.2c0 3.017 0 4.525.937 5.463S6.184 18 9.201 18"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m17.197 18.002-1.372-1.372m.458-2.286a2.743 2.743 0 1 1-5.486 0 2.743 2.743 0 0 1 5.486 0M5.998 6.004h6.4m-6.4 3.2h3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AuditReport.displayName = 'AuditReport';
