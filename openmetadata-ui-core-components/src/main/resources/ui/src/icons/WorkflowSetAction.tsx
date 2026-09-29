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

export const WorkflowSetAction: FC<Props> = ({
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
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.158 10.315c-.142.501-.81.856-2.146 1.564-1.292.685-1.938 1.028-2.459.89a1.3 1.3 0 0 1-.569-.314c-.382-.36-.382-1.059-.382-2.456s0-2.096.382-2.456a1.3 1.3 0 0 1 .57-.314c.52-.137 1.166.205 2.458.89 1.336.709 2.004 1.063 2.146 1.564a1.17 1.17 0 0 1 0 .632"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WorkflowSetAction.displayName = 'WorkflowSetAction';
