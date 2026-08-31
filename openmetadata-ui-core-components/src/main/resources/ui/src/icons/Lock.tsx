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
import type { FC, SVGProps } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const Lock: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => <svg aria-hidden="true" fill="none" height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 20 20" width={size} {...props}><path d="M13.598 7.6v-2a3.6 3.6 0 1 0-7.2 0v2m4.802.002H8.801c-1.868 0-2.801 0-3.508.377a3.2 3.2 0 0 0-1.314 1.314c-.378.707-.378 1.64-.377 3.509 0 1.867 0 2.8.378 3.507a3.2 3.2 0 0 0 1.313 1.314C6 18 6.933 18 8.801 18h2.4c1.867 0 2.8 0 3.508-.377a3.2 3.2 0 0 0 1.313-1.314c.378-.707.378-1.64.378-3.508 0-1.867 0-2.801-.378-3.508a3.2 3.2 0 0 0-1.313-1.314c-.707-.377-1.641-.377-3.509-.377" stroke="currentColor" strokeWidth={1.3} /><path d="M10.002 14.399a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2" stroke="currentColor" strokeWidth={1.3} /></svg>;
Lock.displayName = "Lock";