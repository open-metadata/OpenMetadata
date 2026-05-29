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
import { render, screen } from '@testing-library/react';
import CsvCellPreview from './CsvCellPreview.component';

describe('CsvCellPreview', () => {
  it('should render an avatar chip for an owner', () => {
    render(<CsvCellPreview column="owners" value="user:admin" />);

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should render a chip per owner/team', () => {
    render(<CsvCellPreview column="owners" value="user:admin;team:Finance" />);

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
  });

  it('should render tag chips', () => {
    render(<CsvCellPreview column="tags" value="PII.Sensitive;Tier1" />);

    expect(screen.getByText('PII.Sensitive')).toBeInTheDocument();
    expect(screen.getByText('Tier1')).toBeInTheDocument();
  });

  it('should render an em-dash when empty', () => {
    render(<CsvCellPreview column="owners" value="" />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
