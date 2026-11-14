/*
 *  Copyright 2026 Collate.
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
import type { FC, SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const SectionLineDashed: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 19 40"
    width={size}
    {...props}>
    <path
      d="M18.52.776H.938v38H18.52"
      stroke="currentColor"
      strokeDasharray="1.6 1.6"
      strokeWidth={0.8}
    />
  </svg>
);
SectionLineDashed.displayName = 'SectionLineDashed';
