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

export const TextEditorEmoji: FC<Props> = ({
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
      d="M6.25 8.125a1.125 1.125 0 0 1 2.25 0m3 0a1.125 1.125 0 0 1 2.25 0M11.501 11.5c.722 0 1.083 0 1.3.368.218.367.09.602-.167 1.07a3 3 0 0 1-5.266 0c-.257-.468-.385-.703-.167-1.07s.578-.368 1.3-.368z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TextEditorEmoji.displayName = 'TextEditorEmoji';
