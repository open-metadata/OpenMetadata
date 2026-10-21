/*
 *  Copyright 2026 Collate.
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
import type { FC, SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const ConstraintSort: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 16 16"
    width={size}
    {...props}>
    <path
      d="M1.152 10.27a.5.5 0 0 0-.01.707l1.922 1.983a.497.497 0 0 0 .717 0l1.924-1.983a.5.5 0 1 0-.718-.696l-1.064 1.097V3.387a.5.5 0 1 0-1 0v7.991l-1.064-1.097a.5.5 0 0 0-.707-.01m12.288-3.81a.5.5 0 0 0-.5-.5H7.514a.5.5 0 1 0 0 1h5.426a.5.5 0 0 0 .5-.5m-1.56 3.076a.5.5 0 0 0-.5-.5H7.514a.5.5 0 1 0 0 1h3.866a.5.5 0 0 0 .5-.5m-4.366 2.576a.5.5 0 1 0 0 1H9.82a.5.5 0 1 0 0-1zM14.5 2.887H7.514a.5.5 0 1 0 0 1H14.5a.5.5 0 1 0 0-1"
      fill="currentColor"
    />
  </svg>
);
ConstraintSort.displayName = 'ConstraintSort';
