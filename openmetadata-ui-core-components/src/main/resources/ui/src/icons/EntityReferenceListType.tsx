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

export const EntityReferenceListType: FC<Props> = ({
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
      d="M6.79 2.36h11.208M6.79 8.902h11.208M6.79 15.031h11.208M6.79 4.969h7.32m-7.32 6.539h7.32M6.79 17.64h7.32"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={3.304}
      cy={3.663}
      r={1.304}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={3.304}
      cy={10.206}
      r={1.304}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={3.304}
      cy={16.335}
      r={1.304}
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
EntityReferenceListType.displayName = 'EntityReferenceListType';
