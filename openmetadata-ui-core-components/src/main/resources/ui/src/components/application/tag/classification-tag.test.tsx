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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassificationTag } from './classification-tag';
import { DEFAULT_TAG_COLOR } from './tag.constants';

describe('ClassificationTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the label text', () => {
    render(<ClassificationTag label="PII.Sensitive" />);

    expect(screen.getByText('PII.Sensitive')).toBeInTheDocument();
  });

  it('should render the default icon when no icon prop is passed', () => {
    const { container } = render(<ClassificationTag label="PII.Sensitive" />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should render an icon when an icon prop is passed', async () => {
    const { container } = render(
      <ClassificationTag icon="Tag01" label="PII.Sensitive" />
    );

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('should not render a redirect link when no href is passed', () => {
    render(<ClassificationTag label="PII.Sensitive" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should render a redirect link when href is passed', () => {
    render(
      <ClassificationTag href="/classification/pii" label="PII.Sensitive" />
    );

    const link = screen.getByRole('link');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/classification/pii');
  });

  it('should make the entire badge the link, including the icon, not just the label', () => {
    const { container } = render(
      <ClassificationTag href="/classification/pii" label="PII.Sensitive" />
    );

    const link = screen.getByRole('link');
    const icon = screen.getByTestId('classification-icon');

    expect(container.firstChild).toBe(link);
    expect(link).toContainElement(icon);
    expect(link).toContainElement(screen.getByText('PII.Sensitive'));
  });

  it('should not render a tooltip trigger when no tooltip is passed', () => {
    render(<ClassificationTag label="PII.Sensitive" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render a tooltip trigger when tooltip is passed', () => {
    render(
      <ClassificationTag label="PII.Sensitive" tooltip="Contains PII data" />
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should apply the disabled styling classes when disabled is true', () => {
    const { container } = render(
      <ClassificationTag disabled label="PII.Sensitive" />
    );

    expect(container.firstChild).toHaveClass(
      'tw:cursor-not-allowed',
      'tw:opacity-50'
    );
  });

  it('should not render a delete button when onDelete is not passed', () => {
    render(<ClassificationTag label="PII.Sensitive" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should call onDelete once with the native event when the delete button is clicked, without bubbling to a parent handler', () => {
    const onDelete = vi.fn();
    const onParentClick = vi.fn();

    render(
      <div role="presentation" onClick={onParentClick}>
        <ClassificationTag label="PII.Sensitive" onDelete={onDelete} />
      </div>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(expect.any(Event));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('should set --tag-color to the default hex when no color prop is passed', () => {
    const { container } = render(<ClassificationTag label="PII.Sensitive" />);

    const badge = container.firstChild as HTMLElement;

    expect(badge.style.getPropertyValue('--tag-color')).toBe(DEFAULT_TAG_COLOR);
  });

  it('should set --tag-color to a custom color when the color prop is passed', () => {
    const customColor = '#FF5733';
    const { container } = render(
      <ClassificationTag color={customColor} label="PII.Sensitive" />
    );

    const badge = container.firstChild as HTMLElement;

    expect(badge.style.getPropertyValue('--tag-color')).toBe(customColor);
  });

  it('should apply the size class for a non-default size', () => {
    const { container } = render(
      <ClassificationTag label="PII.Sensitive" size="md" />
    );

    expect(container.firstChild).toHaveClass('tw:text-sm');
  });

  it('should render a badge with the tag-tinted class and no other inline style property', () => {
    const { container } = render(<ClassificationTag label="PII.Sensitive" />);

    const badge = container.firstChild as HTMLElement;

    expect(badge).toHaveClass('tag-tinted');
    expect(badge.style).toHaveLength(1);
    expect(badge.style[0]).toBe('--tag-color');
  });
});
