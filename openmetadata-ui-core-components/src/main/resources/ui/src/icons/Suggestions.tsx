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

export const Suggestions: FC<Props> = ({
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
      d="M10.85 8.935 7.299 10.14a.2.2 0 0 0 0 .379l3.553 1.205a.2.2 0 0 1 .125.125l1.205 3.552a.2.2 0 0 0 .379 0l1.205-3.552a.2.2 0 0 1 .125-.125l3.552-1.205a.2.2 0 0 0 0-.379L13.89 8.935a.2.2 0 0 1-.125-.125L12.56 5.257a.2.2 0 0 0-.379 0L10.976 8.81a.2.2 0 0 1-.125.125ZM4.227 5.388l-1.669.566a.2.2 0 0 0 0 .379l1.67.566a.2.2 0 0 1 .125.125l.566 1.67a.2.2 0 0 0 .379 0l.566-1.67A.2.2 0 0 1 5.99 6.9l1.67-.566a.2.2 0 0 0 0-.379l-1.67-.566a.2.2 0 0 1-.125-.125l-.566-1.67a.2.2 0 0 0-.379 0l-.566 1.67a.2.2 0 0 1-.126.125Zm1.37 8.746-1.052.357a.2.2 0 0 0 0 .38l1.052.356a.2.2 0 0 1 .125.125l.357 1.053a.2.2 0 0 0 .379 0l.357-1.053a.2.2 0 0 1 .125-.125l1.053-.357a.2.2 0 0 0 0-.379l-1.053-.357a.2.2 0 0 1-.125-.125l-.357-1.052a.2.2 0 0 0-.379 0l-.357 1.052a.2.2 0 0 1-.125.125Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Suggestions.displayName = 'Suggestions';
