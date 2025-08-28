import { Card } from './card-compound';
import { Button } from '@/components/base/buttons/button';
import { Plus, Settings, Download } from '@untitledui/icons';

/**
 * Example 1: Display variants
 */
export const DisplayVariantsExample = () => {
  const variants = [
    { variant: 'display-2xl', label: 'Display 2XL (72px)' },
    { variant: 'display-xl', label: 'Display XL (60px)' },
    { variant: 'display-lg', label: 'Display LG (48px)' },
    { variant: 'display-md', label: 'Display MD (36px)' },
    { variant: 'display-sm', label: 'Display SM (30px)' },
    { variant: 'xl', label: 'XL (20px)' },
    { variant: 'lg', label: 'LG (18px)' },
    { variant: 'md', label: 'MD (16px)' },
    { variant: 'sm', label: 'SM (14px)' },
    { variant: 'xs', label: 'XS (12px)' },
  ] as const;

  return (
    <div className="space-y-4">
      {variants.map(({ variant, label }) => (
        <Card key={variant} padding="sm">
          <Card.Header
            title={label}
            titleVariant={variant}
            description="This is the description text"
            badge="New"
            padding="md"
          />
        </Card>
      ))}
    </div>
  );
};

/**
 * Example 2: Color variations
 */
export const ColorVariationsExample = () => {
  return (
    <div className="space-y-4">
      <Card>
        <Card.Header
          title="Primary Title Color"
          titleColor="primary"
          description="Secondary description color"
          descriptionColor="secondary"
          badge="Default"
          badgeColor="gray"
          padding="md"
          background="white"
        />
      </Card>

      <Card>
        <Card.Header
          title="Brand Title Color"
          titleColor="brand"
          description="Tertiary description color"
          descriptionColor="tertiary"
          badge="Success"
          badgeColor="success"
          padding="md"
          background="gray"
        />
      </Card>

      <Card background="gray">
        <Card.Header
          title="White Title on Dark Background"
          titleColor="white"
          description="Light description text"
          descriptionColor="primary"
          badge="Warning"
          badgeColor="warning"
          padding="md"
          background="primary"
        />
      </Card>
    </div>
  );
};

/**
 * Example 3: Border variations
 */
export const BorderVariationsExample = () => {
  return (
    <div className="space-y-4">
      <Card.Header
        title="Bottom Border"
        description="Header with bottom border only"
        border={{ show: true, side: 'bottom', color: 'light', width: 'sm' }}
        padding="md"
      />

      <Card.Header
        title="All Borders"
        description="Header with borders on all sides"
        border={{ show: true, side: 'all', color: 'default', width: 'md' }}
        padding="md"
      />

      <Card.Header
        title="Dark Top Border"
        description="Header with dark top border"
        border={{ show: true, side: 'top', color: 'dark', width: 'lg' }}
        padding="md"
      />
    </div>
  );
};

/**
 * Example 4: With avatar and actions
 */
export const AvatarActionsExample = () => {
  return (
    <Card>
      <Card.Header
        title="John Doe"
        titleVariant="lg"
        subtitle="john.doe@example.com"
        avatar={{
          src: 'https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80',
          alt: 'John Doe',
          size: 'lg',
        }}
        badge="Pro"
        badgeColor="brand"
        actions={
          <>
            <Button color="secondary" size="sm" iconLeading={Settings}>
              Settings
            </Button>
            <Button color="primary" size="sm" iconLeading={Plus}>
              Follow
            </Button>
          </>
        }
        menuButton
        padding="lg"
        background="white"
        border={{ show: true, side: 'bottom', color: 'light' }}
      />
    </Card>
  );
};

/**
 * Example 5: Shadow and padding variations
 */
export const ShadowPaddingExample = () => {
  const shadows = ['none', 'sm', 'md', 'lg', 'xl'] as const;
  const paddings = ['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Shadow Variations</h3>
        {shadows.map((shadow) => (
          <Card.Header
            key={shadow}
            title={`Shadow: ${shadow}`}
            description="Different shadow depth"
            shadow={shadow}
            padding="md"
            background="white"
          />
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Padding Variations</h3>
        {paddings.map((padding) => (
          <Card.Header
            key={padding}
            title={`Padding: ${padding}`}
            description="Different padding sizes"
            padding={padding}
            background="gray"
            border={{ show: true, side: 'all', color: 'light' }}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Example 6: Sticky header
 */
export const StickyHeaderExample = () => {
  return (
    <div className="h-96 overflow-y-auto border rounded-lg">
      <Card.Header
        title="Sticky Header"
        description="This header stays at the top when scrolling"
        badge="Sticky"
        badgeColor="brand"
        actions={
          <Button color="primary" size="sm" iconLeading={Download}>
            Download
          </Button>
        }
        sticky
        padding="md"
        background="white"
        shadow="sm"
        border={{ show: true, side: 'bottom', color: 'light' }}
      />
      <Card.Body>
        <div className="space-y-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <p key={i} className="text-gray-600">
              Scroll to see the sticky header in action. Content line {i + 1}
            </p>
          ))}
        </div>
      </Card.Body>
    </div>
  );
};

/**
 * Example 7: Complex composition
 */
export const ComplexCompositionExample = () => {
  return (
    <Card border="sm" borderColor="light" shadow="md">
      <Card.Header
        title="Project Dashboard"
        titleVariant="display-sm"
        titleColor="primary"
        description="Monitor your project progress and team performance"
        badge="Beta"
        badgeColor="warning"
        actions={
          <div className="flex gap-2">
            <Button color="tertiary" size="sm">
              Export
            </Button>
            <Button color="secondary" size="sm">
              Share
            </Button>
            <Button color="primary" size="sm" iconLeading={Plus}>
              Add Widget
            </Button>
          </div>
        }
        menuButton
        padding="lg"
        background="white"
        border={{ show: true, side: 'bottom', color: 'light', width: 'sm' }}
        actionsAlign="center"
      />
      <Card.Body>
        <p className="text-gray-600">Dashboard content goes here...</p>
      </Card.Body>
      <Card.Footer divider>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Last updated 5 minutes ago</span>
          <Button color="tertiary" size="sm">
            Refresh
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
};