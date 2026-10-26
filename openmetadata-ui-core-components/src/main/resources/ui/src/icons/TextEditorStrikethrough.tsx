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

export const TextEditorStrikethrough: FC<Props> = ({
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
      d="M9.197 10h1.605c1.773 0 3.21 1.455 3.21 3.25s-1.437 3.25-3.21 3.25H9.197c-1.772 0-3.21-1.455-3.21-3.25m8.025-6.5c0-1.795-1.437-3.25-3.21-3.25H9.197c-1.772 0-3.21 1.455-3.21 3.25q.002.422.102.813M3.5 10h13"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TextEditorStrikethrough.displayName = 'TextEditorStrikethrough';
