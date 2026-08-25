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
    expect(screen.getByText('AD')).toBeInTheDocument();
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

  it('should render glossary term chips as hierarchy paths', () => {
    render(
      <CsvCellPreview
        column="glossaryTerms"
        value="BusinessGlossary.Revenue.NetSales"
      />
    );

    expect(
      screen.getByText('BusinessGlossary / Revenue / NetSales')
    ).toBeInTheDocument();
    expect(
      screen.getByTitle('BusinessGlossary.Revenue.NetSales')
    ).toBeInTheDocument();
  });

  it('should apply item style colors to chips', () => {
    render(
      <CsvCellPreview
        column="tags"
        itemStyles={{ 'PII.Sensitive': '#5925dc' }}
        value="PII.Sensitive"
      />
    );

    expect(screen.getByText('PII.Sensitive')).toHaveStyle({
      color: '#5925dc',
    });
  });

  it('should render tier chips', () => {
    render(<CsvCellPreview column="tiers" value="Tier.Tier1" />);

    expect(screen.getByText('Tier.Tier1')).toBeInTheDocument();
  });

  it('should render quoted domain values as clean chips', () => {
    render(<CsvCellPreview column="domains" value='"Finance";"Marketing"' />);

    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('should render custom properties as label/value chips', () => {
    render(
      <CsvCellPreview
        column="extension"
        value="costCenter:FIN-204;reviewCadence:Quarterly"
      />
    );

    expect(screen.getByTitle('Cost Center: FIN-204')).toBeInTheDocument();
    expect(screen.getByTitle('Review Cadence: Quarterly')).toBeInTheDocument();
  });

  it('should render an em-dash when empty', () => {
    render(<CsvCellPreview column="owners" value="" />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
