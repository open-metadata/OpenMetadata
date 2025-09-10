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
import React from 'react';

// Custom Checkbox Icons that adapt to size
export const CheckboxBlankIcon = () => (
  <div
    className="checkbox-icon"
    style={{
      width: '100%',
      height: '100%',
      backgroundColor: 'white',
      borderRadius: 4, 
      border: '1px solid',
      borderColor: 'currentColor',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      boxSizing: 'border-box',
    }}
  />
);

export const CheckboxCheckedIcon = () => (
  <div
    className="checkbox-icon"
    style={{
      width: '100%',
      height: '100%',
      backgroundColor: 'currentColor',
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      boxSizing: 'border-box',
    }}
  >
    <svg
      fill="none"
      height="75%" // Responsive size
      width="75%"
      viewBox="0 0 14 14"
      style={{ position: 'absolute' }}
    >
      <path
        d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  </div>
);

export const CheckboxIndeterminateIcon = () => (
  <div
    className="checkbox-icon"
    style={{
      width: '100%',
      height: '100%',
      backgroundColor: 'currentColor',
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      boxSizing: 'border-box',
    }}
  >
    <svg
      fill="none"
      height="60%"
      width="60%"
      viewBox="0 0 14 14"
      style={{ position: 'absolute' }}
    >
      <path
        d="M2.91675 7H11.0834"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  </div>
);

// Create icon instances for theme configuration
export const checkboxBlankIcon = <CheckboxBlankIcon />;
export const checkboxCheckedIcon = <CheckboxCheckedIcon />;
export const checkboxIndeterminateIcon = <CheckboxIndeterminateIcon />;