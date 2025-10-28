# Rule Enforcement System

This system provides a comprehensive way to enforce business rules on entities in the OpenMetadata UI.

## Setup

### 1. Add the Provider to Your App

In your main App component (e.g., `App.tsx` or `AppRouter.tsx`), wrap your application with the `RuleEnforcementProvider`:

```tsx
import { RuleEnforcementProvider } from './context/RuleEnforcementProvider/RuleEnforcementProvider';
import { EntityType } from './enums/entity.enum';

function App() {
  return (
    <RuleEnforcementProvider
      initialEntityTypes={[EntityType.TABLE, EntityType.DASHBOARD]}
    >
      {/* Your app components */}
    </RuleEnforcementProvider>
  );
}
```

## Usage Examples

### Example 1: Using in an Entity Details Component

```tsx
import { useEntityRules } from '../../hooks/useEntityRules';
import { EntityType } from '../../enums/entity.enum';

const TableDetails = () => {
  const { uiHints, isLoading } = useEntityRules({
    entityType: EntityType.TABLE,
  });

  return (
    <div>
      {/* Disable button based on rules */}
      <Button
        disabled={!uiHints.canAddMultipleOwners}
      >
        Add Owner
      </Button>

      {/* Show warnings */}
      {uiHints.warnings.map((warning, index) => (
        <Alert key={index} type="info" message={warning} />
      ))}

      {/* Show domain limit */}
      {uiHints.maxDomains < Infinity && (
        <span>Max domains allowed: {uiHints.maxDomains}</span>
      )}
    </div>
  );
};
```

### Example 2: Owner Selection Component

```tsx
import { useEntityRules } from '../../hooks/useEntityRules';

const OwnerSelector = ({ entityType, currentOwnerCount }) => {
  const { uiHints } = useEntityRules({ entityType });

  return (
    <Select
      placeholder="Select owner"
      disabled={
        !uiHints.canAddMultipleOwners && currentOwnerCount > 0
      }
    >
      {/* Owner options */}
    </Select>
  );
};
```

### Example 3: Glossary Term Selection for Tables

```tsx
import { useEntityRules } from '../../hooks/useEntityRules';

const GlossaryTermSelector = ({ hasExistingGlossaryTerm }) => {
  const { uiHints } = useEntityRules({
    entityType: EntityType.TABLE,
  });

  const handleGlossaryTermAdd = (term) => {
    if (!uiHints.canAddMultipleGlossaryTermTable && hasExistingGlossaryTerm) {
      message.warning('Tables can only have a single Glossary Term');
      return;
    }

    // Proceed with adding the term
    updateTableTags(term);
  };

  return (
    <Select
      placeholder="Select glossary term"
      disabled={!uiHints.canAddMultipleGlossaryTermTable && hasExistingGlossaryTerm}
      onChange={handleGlossaryTermAdd}
    >
      {/* Glossary term options */}
    </Select>
  );
};
```

### Example 4: Domain Assignment Component

```tsx
import { useEntityRules } from '../../hooks/useEntityRules';

const DomainAssignment = ({ currentDomainCount, entityType }) => {
  const { uiHints } = useEntityRules({ entityType });

  const handleAddDomain = (domain) => {
    if (currentDomainCount >= uiHints.maxDomains) {
      message.warning(`Maximum ${uiHints.maxDomains} domain(s) allowed`);
      return;
    }

    // Proceed with adding domain
    updateEntity(domain);
  };

  return (
    <div>
      <Typography.Text>
        Domains ({currentDomainCount}/{uiHints.maxDomains})
      </Typography.Text>

      <Button
        onClick={() => setShowDomainModal(true)}
        disabled={currentDomainCount >= uiHints.maxDomains}
      >
        Add Domain
      </Button>

      {uiHints.requireDomainForDataProduct && currentDomainCount === 0 && (
        <Alert
          type="warning"
          message="A domain must be set before adding data products"
        />
      )}
    </div>
  );
};
```

### Example 5: Using Context Directly

```tsx
import { useRuleEnforcement } from '../../context/RuleEnforcementProvider/RuleEnforcementProvider';

const CustomComponent = () => {
  const {
    fetchRulesForEntity,
    getUIHintsForEntity
  } = useRuleEnforcement();

  useEffect(() => {
    // Fetch rules for a specific entity type
    fetchRulesForEntity('customEntityType');
  }, []);

  const hints = getUIHintsForEntity('customEntityType');

  return (
    <div>
      {hints.warnings.map(warning => (
        <Alert message={warning} />
      ))}
    </div>
  );
};
```

## Available Rules

### 1. Multiple Users or Single Team Ownership
- Enforces that an entity must have either multiple user owners OR a single team owner
- Cannot have both team and single user owner

### 2. Multiple Domains Not Allowed
- Restricts entities to be assigned to only one domain
- Can be ignored for specific entity types (e.g., user, team)

### 3. Multiple Data Products Not Allowed
- Restricts entities to be assigned to only one data product

### 4. Data Product Domain Validation
- Ensures data products assigned to an entity match the entity's domains
- Requires domain to be set before adding data products

### 5. Single Glossary Term for Tables
- Restricts tables to have only one Glossary Term
- Applies specifically to table entities
- Filters tags by source "Glossary" to count only glossary terms

## API Reference

### useEntityRules Hook

```tsx
const {
  rules,           // Parsed rules for the entity type
  uiHints,         // UI hints (what to disable/enable)
  isLoading,       // Loading state
} = useEntityRules({
  entityType: EntityType.TABLE,
  autoFetch: true, // Auto-fetch rules on mount
});
```

### UI Hints Structure

```tsx
interface UIHints {
  canAddMultipleOwners: boolean;
  canAddTeamOwner: boolean;
  canAddMultipleDomains: boolean;
  canAddMultipleDataProducts: boolean;
  canAddMultipleGlossaryTermTable: boolean;
  maxDomains: number;
  maxDataProducts: number;
  requireDomainForDataProduct: boolean;
  warnings: string[];
}
```

## Adding Custom Rules

To add custom rules, you need to:

1. Add custom operation in `RuleEnforcementUtils.ts`:

```tsx
jsonLogic.add_operation('customRule', (data) => {
  // Your custom logic
  return true; // or false
});
```

2. Update the `parseRule` function to recognize your rule type

3. Update `canPerformAction` and `getUIHints` to handle your custom rule

## Testing

The system includes comprehensive error handling:
- Invalid rule JSON is safely handled
- Network errors show appropriate toast messages
- Rules default to "valid" if evaluation fails to prevent blocking users

## Performance Considerations

- Rules are fetched once per entity type and cached
- Use `autoFetch: false` if you want to control when rules are fetched
- The provider uses memoization to prevent unnecessary re-computations