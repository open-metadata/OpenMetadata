---
title: How to change the Login Page and Nav Bar Logo
slug: /how-to-guides/how-to-add-custom-logo
---

# How to add a custom logo for the application

To change the Logo for the application, we need to update logo at two locations.

1. Login Page

{% image
src="/images/v1.2/how-to-guides/login-Page-Logo.png"
alt="loginPage-image"
/%}

2. Navigation Bar

{% image
src="/images/v1.2/how-to-guides/nav-Bar-Logo.png"
alt="navBar-image"
/%}


### Step 1: Get the image size as per the following formats.

- Monogram aspect ratio should be 1:1 and Recommended size should be 30 x 30 px
- Logo aspect ratio should be 5:2 and Recommended size should be 150 x 60 px

### Step 2: Configure 'openmetadata.yaml' or the corresponding environment variables

```yaml
applicationConfig:
  logoConfig:
    customLogoUrlPath: ${OM_CUSTOM_LOGO_URL_PATH:-""} #login page logo
    customMonogramUrlPath: ${OM_CUSTOM_MONOGRAM_URL_PATH:-""} #nav bar logo
```

1. `customLogoUrlPath`

   - URL path for the login page logo.

2. `customMonogramUrlPath`

   - URL path for the navbar logo.
