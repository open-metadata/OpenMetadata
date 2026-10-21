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

export const TextEditorLink: FC<Props> = ({
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
      d="M8.491 10.755a3.77 3.77 0 0 0 5.688.407l2.262-2.263a3.772 3.772 0 0 0-5.332-5.333L9.81 4.856m1.697 4.39a3.772 3.772 0 0 0-5.687-.407L3.56 11.1a3.771 3.771 0 0 0 5.332 5.333l1.29-1.29"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TextEditorLink.displayName = 'TextEditorLink';
