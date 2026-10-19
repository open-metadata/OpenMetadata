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
import { EntityReference } from '../../../generated/entity/type';
import DomainTags from './DomainTags';

jest.mock('@openmetadata/ui-core-components', () => ({
  DomainTag: ({
    label,
    href,
    inherited,
    inheritedLabel,
    onDelete,
    ['data-testid']: dataTestId,
    closeButtonTestId,
  }: {
    label: string;
    href?: string;
    inherited?: boolean;
    inheritedLabel?: string;
    onDelete?: (e: Event) => void;
    'data-testid'?: string;
    closeButtonTestId?: string;
  }) => (
    <div
      data-href={href ?? ''}
      data-inherited={String(Boolean(inherited))}
      data-inherited-label={inheritedLabel ?? ''}
      data-testid={dataTestId}>
      {label}
      {onDelete && (
        <button
          data-testid={closeButtonTestId}
          onClick={() => onDelete(new Event('click'))}>
          x
        </button>
      )}
    </div>
  ),
  Button: ({
    children,
    onPress,
    ['data-testid']: dataTestId,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={dataTestId} onClick={onPress}>
      {children}
    </button>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getDomainPath: (fqn?: string) => `/domain/${fqn}`,
}));

const makeDomain = (
  name: string,
  extra: Partial<EntityReference> = {}
): EntityReference => ({
  id: name,
  type: 'domain',
  name,
  displayName: name,
  fullyQualifiedName: name,
  ...extra,
});

describe('DomainTags', () => {
  it('should render the empty placeholder when there are no domains', () => {
    render(<DomainTags domains={[]} />);

    expect(screen.getByTestId('no-domain-text')).toBeInTheDocument();
  });

  it('should render a chip for each domain linking to its detail page', () => {
    render(<DomainTags domains={[makeDomain('Finance')]} />);

    const chip = screen.getByTestId('domain-tag-Finance');

    expect(chip).toHaveTextContent('Finance');
    expect(chip).toHaveAttribute('data-href', '/domain/Finance');
  });

  it('should mark inherited domains and pass the translated inherited label', () => {
    render(
      <DomainTags domains={[makeDomain('Finance', { inherited: true })]} />
    );

    const chip = screen.getByTestId('domain-tag-Finance');

    expect(chip).toHaveAttribute('data-inherited', 'true');
    expect(chip.getAttribute('data-inherited-label')).toContain(
      'label.inherited-entity'
    );
  });

  it('should not pass the inherited flag when showInheritedIcon is false', () => {
    render(
      <DomainTags
        domains={[makeDomain('Finance', { inherited: true })]}
        showInheritedIcon={false}
      />
    );

    expect(screen.getByTestId('domain-tag-Finance')).toHaveAttribute(
      'data-inherited',
      'false'
    );
  });

  it('should render removable chips (no href) when onRemove is provided', () => {
    const onRemove = jest.fn();
    render(
      <DomainTags domains={[makeDomain('Finance')]} onRemove={onRemove} />
    );

    const chip = screen.getByTestId('domain-tag-Finance');

    expect(chip).toHaveAttribute('data-href', '');

    fireEvent.click(screen.getByTestId('remove-domain-Finance'));

    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Finance' })
    );
  });

  it('should collapse domains beyond maxVisible behind a "+N More" toggle', () => {
    const domains = [makeDomain('A'), makeDomain('B'), makeDomain('C')];
    render(<DomainTags domains={domains} maxVisible={2} />);

    expect(screen.getByTestId('domain-tag-A')).toBeInTheDocument();
    expect(screen.getByTestId('domain-tag-B')).toBeInTheDocument();
    expect(screen.queryByTestId('domain-tag-C')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('show-all-domains'));

    expect(screen.getByTestId('domain-tag-C')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('show-less-domains'));

    expect(screen.queryByTestId('domain-tag-C')).not.toBeInTheDocument();
  });
});
