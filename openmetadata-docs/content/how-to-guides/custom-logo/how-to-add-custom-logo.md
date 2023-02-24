---
title: How to change the Login Page and Nav Bar Logo
slug: /how-to-guides/custom-logo/how-to-add-custom-logo
---

To change the Logo for the application, we need to update logo at two locations.

1. Login Page

<Image src="/images/how-to-guides/custom-logo/login-Page-Logo.webp" alt="loginPage-image"/>

2. Navigation Bar

<Image src="/images/how-to-guides/custom-logo/nav-Bar-Logo.webp" alt="navBar-image"/>

# How to add a custom logo for the application

### Step 1: Get the image size as per the following formats.

- Login Page (1 px x 2px)
- Navigation Bar (1 px x 2px)

### Step 2: Configure 'openmetadata.yaml' or the corresponding environment variables

```yaml
applicationConfig:
  logoConfig:
    logoLocationType: ${OM_LOGO_LOCATION_TYPE:-openmetadata} #either "openmetadata' or { "url" or "filePath" , based on this specify either '*AbsoluteFilePath' or '*LogoUrlPath' }
    loginPageLogoAbsoluteFilePath: ${OM_LOGO_LOGIN_LOCATION_FILE_PATH:-""} #login page logo , work in "filePath" mode
    loginPageLogoUrlPath: ${OM_LOGO_LOGIN_LOCATION_URL_PATH:-""} #login page logo , work in "url" mode
    navBarLogoAbsoluteFilePath: ${OM_LOGO_NAVBAR_LOCATION_FILE_PATH:-""} #nav bar logo , work in "filePath" mode
    navBarLogoUrlPath: ${OM_LOGO_NAVBAR_LOCATION_URL_PATH:-""} #nav bar logo , work in "url" mode
```
1. `logoLocationType` set to 'openmetadata'

   - In this case it will take the default OM logo, we don't need to configure anything else.

2. `logoLocationType` set to 'filePath'

   - In this case it will take the custom logo from the specified absolute paths, need to configure following as well.
     - `loginPageLogoAbsoluteFilePath` -> This is the path for Login Page Logo Image.
     - `navBarLogoAbsoluteFilePath` -> This is the path for Navigation Bar Logo Image.

3. `logoLocationType` set to 'url'

   - In this case it will take the custom logo from the specified url, need to configure following as well.
     - `loginPageLogoUrlPath` -> This is the url for Login Page Logo Image.
     - `navBarLogoUrlPath` -> This is the url for Navigation Bar Logo Image.
