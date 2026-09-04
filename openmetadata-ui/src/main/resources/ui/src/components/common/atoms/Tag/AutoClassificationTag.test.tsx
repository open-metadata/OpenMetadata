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
import AutoClassificationTag from './AutoClassificationTag';

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, to, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  )),
}));

describe('AutoClassificationTag (atoms)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the label text', () => {
    render(<AutoClassificationTag label="PII.Sensitive" />);

    expect(screen.getByText('PII.Sensitive')).toBeInTheDocument();
  });

  it('should always render the AutomatedTag icon', () => {
    const { container } = render(
      <AutoClassificationTag label="PII.Sensitive" />
    );

    expect(container.querySelector('svg-mock')).toBeInTheDocument();
  });

  it('should not render a redirect link when no href is passed', () => {
    render(<AutoClassificationTag label="PII.Sensitive" />);

    expect(screen.queryByTestId('tag-redirect-link')).not.toBeInTheDocument();
  });

  it('should render a redirect link when href is passed', () => {
    render(
      <AutoClassificationTag href="/classification/pii" label="PII.Sensitive" />
    );

    const link = screen.getByTestId('tag-redirect-link');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/classification/pii');
  });

  it('should not render a tooltip trigger when no tooltip is passed', () => {
    render(<AutoClassificationTag label="PII.Sensitive" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render a tooltip trigger when tooltip is passed', () => {
    render(
      <AutoClassificationTag
        label="PII.Sensitive"
        tooltip="Auto-classified as PII"
      />
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should apply the disabled styling classes when disabled is true', () => {
    const { container } = render(
      <AutoClassificationTag disabled label="PII.Sensitive" />
    );

    expect(container.firstChild).toHaveClass(
      'tw:cursor-not-allowed',
      'tw:opacity-50'
    );
  });

  it('should not render a delete button when onDelete is not passed', () => {
    render(<AutoClassificationTag label="PII.Sensitive" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should call onDelete once with the native event when the delete button is clicked, without bubbling to a parent handler', () => {
    const onDelete = jest.fn();
    const onParentClick = jest.fn();

    render(
      <div role="presentation" onClick={onParentClick}>
        <AutoClassificationTag label="PII.Sensitive" onDelete={onDelete} />
      </div>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(expect.any(Event));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('should apply the default sm size class', () => {
    const { container } = render(
      <AutoClassificationTag label="PII.Sensitive" />
    );

    expect(container.firstChild).toHaveClass('tw:h-5', 'tw:text-xs');
  });

  it('should apply the size class for a non-default size', () => {
    const { container } = render(
      <AutoClassificationTag label="PII.Sensitive" size="md" />
    );

    expect(container.firstChild).toHaveClass('tw:h-6', 'tw:text-sm');
  });
});
