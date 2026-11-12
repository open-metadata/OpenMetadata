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

export const IngestionPipeline: FC<Props> = ({
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
    <path
      d="M9.513 5.664H3.83c-.442 0-.664 0-.844.051a1.35 1.35 0 0 0-.936.933C2 6.828 2 7.05 2 7.49c0 .223 0 .334.017.44.041.26.158.503.336.698.072.08.16.149.334.288l3.378 2.695c.5.4.75.599.884.876.133.278.133.597.133 1.236v1.849c0 1.139 0 1.708.365 1.898s.833-.137 1.768-.79l.1-.07c.566-.396.85-.593 1.003-.887.153-.293.153-.638.153-1.328v-.672c0-.639 0-.958.133-1.236.134-.277.384-.477.884-.876l.677-.54m2.486-7.159a2.39 2.39 0 1 1 0 4.783m2.077-3.579L18 4.39m-1.272 3.1L18 8.216m-3.35-4.304a2.39 2.39 0 1 0 0 4.783m0 0v1.435m-2.077-5.014-1.271-.726m1.271 3.1-1.271.726m3.348-4.304V2.477"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
IngestionPipeline.displayName = 'IngestionPipeline';
