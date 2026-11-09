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

export const Eventsubscription: FC<Props> = ({
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
      d="M18 6.8c0-1.84-.64-3.44-1.6-4.8M3.6 2C2.64 3.36 2 4.96 2 6.8m11.2 8a3.2 3.2 0 0 1-6.4 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M3.95 14.8h12.1c.583 0 .874 0 1.043-.084a.8.8 0 0 0 .425-.885c-.04-.184-.222-.411-.585-.866l-.136-.17c-.365-.455-.547-.683-.701-.922a5.6 5.6 0 0 1-.867-2.47c-.029-.283-.029-.575-.029-1.159V7.2c0-.371 0-.557-.01-.714a4.8 4.8 0 0 0-4.476-4.476C10.558 2 10.372 2 10 2s-.557 0-.714.01a4.8 4.8 0 0 0-4.475 4.476c-.01.157-.01.343-.01.714v1.044c0 .584 0 .876-.03 1.16a5.6 5.6 0 0 1-.866 2.469c-.154.239-.336.467-.701.923l-.136.17c-.364.454-.545.681-.585.865a.8.8 0 0 0 .425.885c.169.084.46.084 1.042.084"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Eventsubscription.displayName = 'Eventsubscription';
