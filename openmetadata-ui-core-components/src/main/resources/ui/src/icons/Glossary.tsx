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
      height={15.47}
      rx={2.2}
      stroke="currentColor"
      strokeWidth={1.3}
      width={12.6}
      x={3.699}
      y={2.531}
    />
    <path
      d="M9.835 2.65h3.466a.32.32 0 0 1 .198.06q.014.014.018.02v6.855l-1.215-1.006-.082-.061a1.15 1.15 0 0 0-1.386.061L9.619 9.585V2.729l.018-.018a.32.32 0 0 1 .198-.06"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Glossary.displayName = 'Glossary';
