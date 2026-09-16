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
import { fireEvent, render, screen } from '@testing-library/react';
import MetricTag from './MetricTag';
import { DEFAULT_TAG_COLOR } from './Tag.constant';

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, to, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  )),
}));

describe('MetricTag (atoms)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the label text', () => {
    render(<MetricTag label="Revenue" />);

    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('should render the default icon when no icon prop is passed', () => {
    const { container } = render(<MetricTag label="Revenue" />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should render a redirect link when href is passed', () => {
    render(<MetricTag href="/metric/revenue" label="Revenue" />);

    const link = screen.getByTestId('tag-redirect-link');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/metric/revenue');
  });

  it('should not render a redirect link when no href is passed', () => {
    render(<MetricTag label="Revenue" />);

    expect(screen.queryByTestId('tag-redirect-link')).not.toBeInTheDocument();
  });

  it('should call onDelete once with the native event without bubbling to a parent handler', () => {
    const onDelete = jest.fn();
    const onParentClick = jest.fn();

    render(
      <div role="presentation" onClick={onParentClick}>
        <MetricTag label="Revenue" onDelete={onDelete} />
      </div>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(expect.any(Event));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('should render a fully rounded, tinted pill badge with the default color', () => {
    const { container } = render(<MetricTag label="Revenue" />);

    const badge = container.firstChild as HTMLElement;

    expect(badge).toHaveClass('tw:rounded-full', 'tag-tinted');
    expect(badge.style.getPropertyValue('--tag-color')).toBe(DEFAULT_TAG_COLOR);
  });
});
