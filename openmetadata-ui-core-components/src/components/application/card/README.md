# Card Components

A flexible and reusable card component system for displaying structured content with headers, bodies, and footers.

## CardHeader

The `CardHeader` component provides a consistent header layout for cards with support for avatars, titles, badges, descriptions, and actions.

### Basic Usage

```tsx
import { Card } from '@openmetadata/ui-core-components/dist/components/application/card';
import { Button } from '@openmetadata/ui-core-components/dist/components/base/buttons/button';

// Simple header
<Card.Header
  title="Team Members"
  description="Manage your team members and their permissions."
/>

// With badge
<Card.Header
  title="Team Members"
  badge="10/20 seats"
  description="Manage your team members and their permissions."
/>

// With actions
<Card.Header
  title="Team Members"
  badge="10/20 seats"
  description="Manage your team members and their permissions."
  actions={
    <>
      <Button color="secondary">Invite</Button>
      <Button color="primary">Add Member</Button>
    </>
  }
/>

// With avatar
<Card.Header
  title="Olivia Rhye"
  subtitle="olivia@untitledui.com"
  badge="Admin"
  avatar={{
    src: "https://example.com/avatar.jpg",
    alt: "Olivia Rhye",
    size: "lg"
  }}
  menuButton
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | Required | The main title of the header |
| `badge` | `ReactNode \| string` | - | Badge content to display next to title |
| `description` | `string` | - | Description text below the title |
| `subtitle` | `string` | - | Subtitle (used with avatar variant) |
| `avatar` | `object` | - | Avatar configuration with src, alt, name, initials, size |
| `actions` | `ReactNode` | - | Action buttons or content |
| `menuButton` | `boolean \| ReactNode` | - | Show menu button or custom menu |
| `onMenuClick` | `() => void` | - | Callback for menu button click |
| `size` | `'sm' \| 'md'` | `'md'` | Size variant |
| `className` | `string` | - | Additional CSS classes |

### Examples

#### Profile Card Header
```tsx
<Card.Header
  title="John Doe"
  subtitle="john.doe@company.com"
  badge="New User"
  avatar={{
    src: "/path/to/avatar.jpg",
    alt: "John Doe",
    size: "lg"
  }}
  actions={
    <>
      <Button color="secondary">Message</Button>
      <Button color="primary">Follow</Button>
    </>
  }
  menuButton
/>
```

#### Domain List Header
```tsx
<Card.Header
  title="Domains"
  badge={domainCount}
  description="Browse and manage your data domains"
  actions={
    <Button color="primary" iconLeading={Plus}>
      Add Domain
    </Button>
  }
/>
```

#### Settings Card Header
```tsx
<Card.Header
  size="sm"
  title="API Settings"
  badge={
    <div className="flex items-center gap-1">
      <span className="size-2 rounded-full bg-green-500" />
      <span className="text-xs">Active</span>
    </div>
  }
  description="Configure your API endpoints and authentication"
  menuButton
  onMenuClick={() => setMenuOpen(true)}
/>
```

### Responsive Behavior

The CardHeader component is fully responsive:
- **Mobile**: Stacked layout with smaller padding and avatar sizes
- **Desktop**: Horizontal layout with larger spacing
- **Menu Button**: Positioned absolutely on mobile, inline on desktop
- **Actions**: Can be hidden on mobile using `className="max-md:hidden"` on individual buttons

### Customization

The component uses Tailwind CSS classes and can be customized via:
- `className` prop for the container
- `contentClassName` prop for the content section
- Custom `badge` and `menuButton` ReactNodes for complete control

### Integration with OpenMetadata UI

```tsx
import { Card } from '@openmetadata/ui-core-components/dist/components/application/card';

// In DomainListPage
<TableCard.Root>
  <Card.Header
    title={t('label.domain-plural')}
    badge={filteredDomains.length}
    description={t('message.domains-description')}
    actions={
      <Button
        color="primary"
        iconLeading={Plus}
        onClick={onAddDomain}
      >
        {t('label.add-entity', { entity: t('label.domain') })}
      </Button>
    }
  />
  {/* Table content */}
</TableCard.Root>
```