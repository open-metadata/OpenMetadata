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

export const HealthCheck: FC<Props> = ({
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
      d="M15.97 3.596c-2.145-1.316-4.018-.786-5.142.06-.462.346-.692.519-.828.519s-.366-.173-.828-.52C8.048 2.81 6.175 2.28 4.03 3.596 1.214 5.323.577 11.021 7.072 15.827c1.237.916 1.855 1.374 2.928 1.374s1.691-.458 2.928-1.374c6.495-4.806 5.857-10.504 3.042-12.23"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.2 10.802h-.8c-.364 0-.747.028-1.074-.223-.124-.096-.207-.228-.372-.493l-.952-1.747c-.131-.242-.197-.363-.286-.405a.3.3 0 0 0-.245-.005c-.09.038-.16.156-.302.392l-1.593 2.655c-.125.208-.188.313-.27.352a.3.3 0 0 1-.232.01c-.086-.033-.157-.132-.3-.33l-.819-1.14c-.204-.247-.404-.496-.675-.595-.198-.071-.425-.071-.88-.071H2.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
HealthCheck.displayName = 'HealthCheck';
