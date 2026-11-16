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

export const EmptyTableSuite: FC<Props> = ({
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
      d="M13.2 3.6c.744 0 1.116 0 1.42.082a2.4 2.4 0 0 1 1.698 1.697c.082.305.082.677.082 1.421v7.36c0 1.344 0 2.016-.262 2.53a2.4 2.4 0 0 1-1.049 1.048c-.513.262-1.185.262-2.53.262H7.44c-1.344 0-2.016 0-2.529-.262a2.4 2.4 0 0 1-1.049-1.048c-.261-.514-.261-1.186-.261-2.53V6.8c0-.744 0-1.116.081-1.421a2.4 2.4 0 0 1 1.697-1.697C5.684 3.6 6.056 3.6 6.8 3.6m6.4 0v.32c0 .448 0 .672-.088.843a.8.8 0 0 1-.35.35c-.17.087-.394.087-.842.087H8.08c-.448 0-.672 0-.844-.087a.8.8 0 0 1-.35-.35C6.8 4.593 6.8 4.368 6.8 3.92V3.6m6.4 0v-.32c0-.448 0-.672-.088-.843a.8.8 0 0 0-.35-.35C12.593 2 12.369 2 11.92 2H8.08c-.448 0-.672 0-.844.087a.8.8 0 0 0-.35.35c-.086.17-.086.395-.086.843v.32m.4 5.6h5.6m-5.6 4h5.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
EmptyTableSuite.displayName = 'EmptyTableSuite';
