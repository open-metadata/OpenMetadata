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

export const ReasonForAccess: FC<Props> = ({
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
      d="M16.398 13.2V6.8c0-2.263 0-3.394-.703-4.097S13.86 2 11.598 2h-3.2C6.135 2 5.004 2 4.3 2.703S3.598 4.537 3.598 6.8v6.4c0 2.263 0 3.394.703 4.097S6.135 18 8.398 18h3.2c2.262 0 3.394 0 4.097-.703s.703-1.834.703-4.097"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.8 2H7.2c0 1.131 0 1.697.35 2.049.352.351.918.351 2.05.351h.8c1.13 0 1.696 0 2.048-.351.351-.352.351-.918.351-2.049M6.793 12.4h3.2m-3.2-3.2h6.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ReasonForAccess.displayName = 'ReasonForAccess';
