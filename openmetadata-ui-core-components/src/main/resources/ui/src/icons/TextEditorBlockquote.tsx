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

export const TextEditorBlockquote: FC<Props> = ({
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
      d="M8.5 7c0 1.414 0 2.121-.44 2.56-.439.44-1.146.44-2.56.44s-2.121 0-2.56-.44C2.5 9.122 2.5 8.415 2.5 7s0-2.121.44-2.56C3.378 4 4.085 4 5.5 4s2.121 0 2.56.44c.44.439.44 1.146.44 2.56"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M8.5 6.25v3.362C8.5 12.59 6.613 15.118 4 16m13.5-9c0 1.414 0 2.121-.44 2.56-.439.44-1.146.44-2.56.44s-2.121 0-2.56-.44c-.44-.439-.44-1.146-.44-2.56s0-2.121.44-2.56C12.378 4 13.085 4 14.5 4s2.121 0 2.56.44c.44.439.44 1.146.44 2.56"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.5 6.25v3.362c0 2.979-1.887 5.506-4.5 6.388"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TextEditorBlockquote.displayName = 'TextEditorBlockquote';
