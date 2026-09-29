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

export const Owners1: FC<Props> = ({
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
      d="M7.666 12.832H6.452c-1.13 0-1.695 0-2.154.14a3.24 3.24 0 0 0-2.159 2.158C2 15.59 2 16.154 2 17.284M12.117 6.357a3.642 3.642 0 1 1-7.284 0 3.642 3.642 0 0 1 7.284 0M9.285 17.284l2.51-.717c.12-.035.18-.052.236-.078a1 1 0 0 0 .141-.083c.05-.036.094-.08.183-.169l5.226-5.226a1.43 1.43 0 1 0-2.024-2.023l-5.226 5.226a2 2 0 0 0-.169.182 1 1 0 0 0-.083.141 2 2 0 0 0-.077.237z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Owners1.displayName = 'Owners1';
