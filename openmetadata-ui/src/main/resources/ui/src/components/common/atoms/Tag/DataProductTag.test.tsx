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
import { fireEvent, render, screen } from '@testing-library/react';
import DataProductTag from './DataProductTag';
import { DEFAULT_TAG_COLOR } from './Tag.constant';
import { computeTagColors } from './Tag.utils';

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, to, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  )),
}));

describe('DataProductTag (atoms)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the label text', () => {
    render(<DataProductTag label="Reporting Suite" />);

    expect(screen.getByText('Reporting Suite')).toBeInTheDocument();
  });

  it('should not render an icon when no icon prop is passed', () => {
    const { container } = render(<DataProductTag label="Reporting Suite" />);

    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('should render an icon when an icon prop is passed', () => {
    const { container } = render(
      <DataProductTag icon="Tag01" label="Reporting Suite" />
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should not render a redirect link when no href is passed', () => {
    render(<DataProductTag label="Reporting Suite" />);

    expect(screen.queryByTestId('tag-redirect-link')).not.toBeInTheDocument();
  });

  it('should render a redirect link when href is passed', () => {
    render(
      <DataProductTag href="/dataProduct/reporting" label="Reporting Suite" />
    );

    const link = screen.getByTestId('tag-redirect-link');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/dataProduct/reporting');
  });

  it('should not render a tooltip trigger when no tooltip is passed', () => {
    render(<DataProductTag label="Reporting Suite" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render a tooltip trigger when tooltip is passed', () => {
    render(<DataProductTag label="Reporting Suite" tooltip="Data product" />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should apply the disabled styling classes when disabled is true', () => {
    const { container } = render(
      <DataProductTag disabled label="Reporting Suite" />
    );

    expect(container.firstChild).toHaveClass(
      'tw:cursor-not-allowed',
      'tw:opacity-50'
    );
  });

  it('should not render a delete button when onDelete is not passed', () => {
    render(<DataProductTag label="Reporting Suite" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should call onDelete once with the native event when the delete button is clicked, without bubbling to a parent handler', () => {
    const onDelete = jest.fn();
    const onParentClick = jest.fn();

    render(
      <div role="presentation" onClick={onParentClick}>
        <DataProductTag label="Reporting Suite" onDelete={onDelete} />
      </div>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(expect.any(Event));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('should apply the default tag color when no color prop is passed', () => {
    const { container } = render(<DataProductTag label="Reporting Suite" />);

    const expected = computeTagColors(DEFAULT_TAG_COLOR);
    const badge = container.firstChild as HTMLElement;

    expect(badge.style.borderColor).toBe(expected.border);
    expect(badge.style.borderLeftColor).toBe(DEFAULT_TAG_COLOR);
  });

  it('should apply a custom color when the color prop is passed', () => {
    const customColor = '#8A2BE2';
    const { container } = render(
      <DataProductTag color={customColor} label="Reporting Suite" />
    );

    const expected = computeTagColors(customColor);
    const badge = container.firstChild as HTMLElement;

    expect(badge.style.borderColor).toBe(expected.border);
    expect(badge.style.borderLeftColor).toBe(customColor);
  });

  it('should apply the size class for a non-default size', () => {
    const { container } = render(
      <DataProductTag label="Reporting Suite" size="md" />
    );

    expect(container.firstChild).toHaveClass('tw:h-6', 'tw:text-sm');
  });

  it('should render a transparent-background badge with a left accent at the raw resolved color', () => {
    const { container } = render(<DataProductTag label="Reporting Suite" />);

    const badge = container.firstChild as HTMLElement;

    expect(badge.style.backgroundColor).toBe('transparent');
    expect(badge.style.borderLeftWidth).toBe('4px');
    expect(badge.style.borderLeftColor).toBe(DEFAULT_TAG_COLOR);
  });
});
