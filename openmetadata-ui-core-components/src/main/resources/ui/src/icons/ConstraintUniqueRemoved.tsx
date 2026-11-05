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

export const ConstraintUniqueRemoved: FC<Props> = ({
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
      d="m14.727 11.254-1.625-.938 1.408-.83a.546.546 0 0 0-.554-.941l-1.94 1.144L9.09 8l2.925-1.689 1.94 1.144a.545.545 0 1 0 .555-.94l-1.408-.83 1.625-.94a.546.546 0 0 0-.546-.945l-1.625.938-.015-1.635a.545.545 0 1 0-1.092.01l.02 2.253-2.925 1.688V3.677l1.961-1.108a.546.546 0 1 0-.537-.95l-1.424.804V.546a.546.546 0 1 0-1.092 0v1.877L6.03 1.618a.546.546 0 0 0-.538.95l1.961 1.11v3.376L4.527 5.366l.02-2.253a.546.546 0 0 0-.54-.55h-.005a.546.546 0 0 0-.546.54L3.44 4.738 1.816 3.8a.546.546 0 0 0-.546.946l1.625.938-1.408.83a.546.546 0 0 0 .554.941l1.94-1.143L6.908 8 3.98 9.69 2.04 8.546a.546.546 0 0 0-.555.94l1.409.83-1.625.94a.546.546 0 0 0 .546.945l1.625-.938.015 1.635a.546.546 0 0 0 .546.54h.005a.546.546 0 0 0 .54-.55l-.02-2.253 2.925-1.688v3.377l-1.96 1.108a.546.546 0 0 0 .537.95l1.423-.804v1.877a.546.546 0 0 0 1.092 0v-1.877l1.424.805a.546.546 0 1 0 .537-.95l-1.96-1.11V8.947l2.924 1.688-.02 2.253a.546.546 0 0 0 .54.55h.006a.546.546 0 0 0 .546-.54l.015-1.636 1.625.939a.548.548 0 0 0 .814-.402.55.55 0 0 0-.268-.544"
      fill="#9F9F9F"
    />
    <path d="M0 8h16" stroke="currentColor" strokeWidth={1.5} />
  </svg>
);
ConstraintUniqueRemoved.displayName = 'ConstraintUniqueRemoved';
