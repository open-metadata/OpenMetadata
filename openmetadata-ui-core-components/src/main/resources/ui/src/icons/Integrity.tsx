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

export const Integrity: FC<Props> = ({
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
      d="M16.135 11.735C17.208 10.37 18 8.855 18 7.355c0-2.295-1.684-4.156-4-4.156-1.2 0-2.4.4-4 2-1.6-1.6-2.8-2-4-2-2.316 0-4 1.86-4 4.156 0 4.057 5.801 8.234 7.267 9.224.216.147.472.22.733.22s.517-.073.733-.22q.127-.085.294-.201c.797-.556.86-1.692.173-2.379"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m15.202 8.8.792.793c.567.567.686 1.444.194 2.077-.596.769-1.736.781-2.424.093l-.162-.162"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m13.6 11.598.155.155c.7.7.652 1.894-.09 2.55-.69.611-1.669.492-2.321-.16l-.145-.145M10 5.2 7.8 7.4a1.414 1.414 0 0 0 2 2L11.2 8c.437-.437.655-.655.89-.772a1.6 1.6 0 0 1 1.421 0c.236.117.454.335.89.771l1.2 1.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Integrity.displayName = 'Integrity';
