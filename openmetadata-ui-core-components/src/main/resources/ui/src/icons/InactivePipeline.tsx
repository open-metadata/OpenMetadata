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
export const InactivePipeline: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => <svg fill="none" viewBox="0 0 20 20" width={size} height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path stroke="currentColor" strokeWidth={1.3} d="M9.198 9.998a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0" /><path stroke="currentColor" strokeWidth={1.3} d="M13.2 5.2H6.8a4.8 4.8 0 1 0 0 9.6h6.4a4.8 4.8 0 1 0 0-9.6" /></svg>;
InactivePipeline.displayName = "InactivePipeline";