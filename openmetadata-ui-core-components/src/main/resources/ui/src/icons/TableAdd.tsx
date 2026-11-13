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

export const TableAdd: FC<Props> = ({
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
    <circle
      cx={13.859}
      cy={13.806}
      r={4.142}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.857 12.36v1.445m0 0v1.449m0-1.45h1.45m-1.45 0h-1.445M2 6.715h12.653M2.332 10.71h6.591m-2.927 3.663V6.715m4.66 1.969v-1.97m3.997 1.666c0-2.981 0-4.472-.927-5.399-.926-.926-2.418-.926-5.4-.926s-4.473 0-5.4.926C2 3.908 2 5.4 2 8.381s0 4.473.926 5.4c.927.926 2.418.926 5.4.926"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TableAdd.displayName = 'TableAdd';
