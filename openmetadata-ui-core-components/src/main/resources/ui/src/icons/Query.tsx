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
export const Query: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => <svg fill="none" viewBox="0 0 20 20" width={size} height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path stroke="currentColor" strokeWidth={1.3} d="M5.645 7.555 8.31 9.777l-2.666 2.222m5.336.446h3.556" /><path stroke="currentColor" strokeWidth={1.3} d="M15.868 2.5H4.312c-1.227 0-2.222.933-2.222 2.083v10.834c0 1.15.995 2.083 2.222 2.083h11.556c1.227 0 2.222-.933 2.222-2.083V4.583c0-1.15-.995-2.083-2.222-2.083" /></svg>;
Query.displayName = "Query";