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

export const TestDefinition: FC<Props> = ({
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
      d="m14.332 15.251.921-.921a2 2 0 0 0 0-2.829L8.498 4.746a2 2 0 0 0-2.828 0l-.922.922a2 2 0 0 0 0 2.828l6.755 6.755a2 2 0 0 0 2.829 0M7.083 7.082l1.333 1.333m1.167-3.833 1.333 1.333m-6.174 3.76 1.334 1.333"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TestDefinition.displayName = 'TestDefinition';
