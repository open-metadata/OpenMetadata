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

export const Edit: FC<Props> = ({
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
      d="M11.762 3.41c.596-.645.894-.968 1.21-1.157a2.48 2.48 0 0 1 2.482-.037c.322.179.63.493 1.244 1.12s.921.942 1.096 1.271a2.64 2.64 0 0 1-.036 2.536c-.185.323-.5.628-1.133 1.237l-7.52 7.246c-1.199 1.154-1.798 1.73-2.546 2.023-.749.293-1.572.271-3.218.228l-.223-.006c-.502-.013-.752-.02-.898-.185-.145-.165-.125-.42-.086-.93l.022-.278c.112-1.437.168-2.155.448-2.801s.765-1.17 1.732-2.22zm-.449.582 4.898 4.913m-4.504 8.997h6.398"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Edit.displayName = 'Edit';
