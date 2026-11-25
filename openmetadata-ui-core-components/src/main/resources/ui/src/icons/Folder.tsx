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

export const Folder: FC<Props> = ({
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
      d="m10.8 6-.892-1.784c-.257-.514-.386-.77-.577-.958a1.6 1.6 0 0 0-.598-.37c-.254-.087-.54-.087-1.115-.087H4.56c-.896 0-1.344 0-1.686.174a1.6 1.6 0 0 0-.7.7C2 4.016 2 4.464 2 5.36V6m0 0h12.16c1.344 0 2.016 0 2.53.261a2.4 2.4 0 0 1 1.048 1.05C18 7.824 18 8.496 18 9.84v3.52c0 1.344 0 2.016-.262 2.53a2.4 2.4 0 0 1-1.048 1.048c-.514.262-1.186.262-2.53.262H5.84c-1.344 0-2.016 0-2.53-.262a2.4 2.4 0 0 1-1.048-1.049C2 15.377 2 14.705 2 13.36z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Folder.displayName = 'Folder';
