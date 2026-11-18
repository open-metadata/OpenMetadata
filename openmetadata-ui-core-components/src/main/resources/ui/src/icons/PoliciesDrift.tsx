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

export const PoliciesDrift: FC<Props> = ({
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
    <path
      d="M7.923 2.617H5.846c-1.292 0-1.938 0-2.432.252a2.3 2.3 0 0 0-1.008 1.008c-.252.494-.252 1.14-.252 2.433v8c0 1.292 0 1.938.252 2.432.221.434.574.787 1.008 1.008.494.252 1.14.252 2.432.252h4.923c1.293 0 1.939 0 2.432-.252a2.3 2.3 0 0 0 1.009-1.008c.251-.494.251-1.14.251-2.432v-.539m-9.23-2.692h3.461m-3.46-3.077h2.691m-2.692 6.154h6.154"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m12.769 6.399.568.574a.5.5 0 0 0 .71 0l1.721-1.74m2.077 1.399c0 2.289-2.47 3.954-3.37 4.484a.7.7 0 0 1-.225.106.5.5 0 0 1-.194 0 .7.7 0 0 1-.225-.106c-.9-.53-3.37-2.195-3.37-4.484v-2.23c0-.373 0-.56.06-.72a.9.9 0 0 1 .253-.368c.127-.113.3-.179.645-.31l2.475-.937a1 1 0 0 1 .193-.062.5.5 0 0 1 .132 0c.05.007.097.025.193.062l2.475.937c.345.131.518.197.645.31.113.1.2.226.253.368.06.16.06.347.06.72z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
PoliciesDrift.displayName = 'PoliciesDrift';
