---
title: How to change the Login Page and Nav Bar Logo
slug: /how-to-guides/custom-logo/how-to-add-custom-logo
---

# How to add a custom logo for the application

To change the Logo for the application, we need to update logo at two locations.

1. Login Page

<Image src="/images/how-to-guides/custom-logo/login-Page-Logo.png" alt="loginPage-image"/>

2. Navigation Bar

<Image src="/images/how-to-guides/custom-logo/nav-Bar-Logo.png" alt="navBar-image"/>

### Step 1: Get the image size as per the following formats.

- Monogram aspect ratio should be 1:1 and Recommended size should be 30 x 30 px
- Logo aspect ratio should be 3:2 and Recommended size should be 150 x 60 px

### Step 2: Configure 'openmetadata.yaml' or the corresponding environment variables

```yaml
applicationConfig:
  logoConfig:
    logoLocationType: ${OM_LOGO_LOCATION_TYPE:-openmetadata} #either "openmetadata' or "url"
    loginPageLogoUrlPath: ${OM_LOGO_LOGIN_LOCATION_URL_PATH:-""} #login page logo , work in "url" mode
    navBarLogoUrlPath: ${OM_LOGO_NAVBAR_LOCATION_URL_PATH:-""} #nav bar logo , work in "url" mode
```

1. `logoLocationType` set to 'openmetadata'

   - In this case it will take the default OM logo, we don't need to configure anything else.

2. `logoLocationType` set to 'url'

   - In this case it will take the custom logo from the specified url, need to configure following as well.
     - `loginPageLogoUrlPath` -> This is the url for Login Page Logo Image.
     - `navBarLogoUrlPath` -> This is the url for Navigation Bar Logo Image.
