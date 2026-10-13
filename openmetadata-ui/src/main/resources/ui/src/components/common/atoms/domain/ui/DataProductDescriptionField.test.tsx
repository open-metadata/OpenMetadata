/*
 *  Copyright 2024 Collate.
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

import { render, screen } from '@testing-library/react';
import { DataProductDescriptionField } from './DataProductDescriptionField';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('DataProductDescriptionField', () => {
  it('renders markdown as plain text', () => {
    render(
      <DataProductDescriptionField description="# 1. Overview of the **C360**" />
    );

    expect(screen.getByText('1. Overview of the C360')).toBeInTheDocument();
  });

  it('renders the placeholder for an empty description', () => {
    render(<DataProductDescriptionField description="" />);

    expect(screen.getByText('--')).toBeInTheDocument();
  });
});
