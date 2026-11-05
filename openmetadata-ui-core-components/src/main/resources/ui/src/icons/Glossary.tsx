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

export const Glossary: FC<Props> = ({
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
    <rect
      height={16}
      rx={2.5}
      stroke="currentColor"
      strokeWidth={1.3}
      width={12}
      x={4}
      y={2}
    />
    <path
      d="M9 2.696v6.793a.5.5 0 0 0 .854.353l.88-.88a.5.5 0 0 1 .707 0l.88.88a.5.5 0 0 0 .853-.353V2.696A.696.696 0 0 0 12.478 2H9.696A.696.696 0 0 0 9 2.696"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Glossary.displayName = 'Glossary';
