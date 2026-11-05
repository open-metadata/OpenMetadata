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

export const Billing: FC<Props> = ({
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
      d="M3.101 2.68c.595 0 1.081 1.382 1.116 3.126.002.11-.088.2-.198.2H3.1c-.539 0-.808 0-.975-.186s-.138-.43-.08-.92c.154-1.294.568-2.22 1.055-2.22Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M4.218 6.037v5.872c0 .838 0 1.257.257 1.422.418.27 1.065-.295 1.39-.5.27-.17.404-.255.553-.26m6.672-6.534c0-1.583 0-2.374-.487-2.866-.487-.491-1.272-.491-2.84-.491H3.11"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={13.06}
      cy={12.384}
      r={4.939}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.09 10.382c-.737 0-1.334.447-1.334 1s.597 1 1.333 1c.737 0 1.333.447 1.333 1s-.596 1-1.333 1m0-4c.58 0 1.075.278 1.258.666m-1.258-.666v-.667m0 4.667c-.58 0-1.074-.279-1.257-.667m1.257.667v.666M6.027 5.512h4.195M6.027 7.734h1.066"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Billing.displayName = 'Billing';
