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

export const WorkflowCheckConditions: FC<Props> = ({
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
      d="M15.368 3.196C13.854 2.443 12 2 10 2s-3.853.443-5.367 1.196c-.743.37-1.114.554-1.474 1.135-.36.58-.36 1.143-.36 2.268v2.79c0 4.547 3.635 7.075 5.74 8.158.586.302.88.453 1.46.453.582 0 .875-.151 1.462-.453 2.105-1.083 5.739-3.61 5.739-8.157V6.599c0-1.125 0-1.687-.36-2.268s-.73-.765-1.473-1.135"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.602 9.6s1.126.202 1.6 1.6c0 0 1.2-2.4 3.2-3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WorkflowCheckConditions.displayName = 'WorkflowCheckConditions';
