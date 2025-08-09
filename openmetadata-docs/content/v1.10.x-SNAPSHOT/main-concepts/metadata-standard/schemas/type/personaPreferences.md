---
title: personaPreferences
slug: /main-concepts/metadata-standard/schemas/type/personapreferences
---

# PersonaPreferences

*User-specific preferences for a persona that override default persona UI customization. These are limited customizations that users can apply to personalize their experience while still inheriting the base persona configuration.*

## Properties

- **`personaId`**: UUID of the persona these preferences belong to. Refer to *basic.json#/definitions/uuid*.
- **`personaName`** *(string)*: Name of the persona for quick reference and linking.
- **`landingPageSettings`** *(object)*: User's personal customizations for the landing page. Cannot contain additional properties.
  - **`headerColor`** *(string)*: Custom header background color for the landing page.
  - **`headerImage`** *(string)*: Reference to a custom header background image (reserved for future use).


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
