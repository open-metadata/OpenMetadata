---
title: How to Add Language Support
slug: /how-to-guides/how-to-add-language-support
---

# How to Add Language Support

To add support for a new language in our internationalization setup using `react-i18next` and `i18next`, please follow the steps below:

## Create a Language JSON File

First, create a new JSON file for the language you want to add in the `openmetadata-ui/src/main/resources/ui/src/locale/languages` directory.

For example, if you want to add support for the `French` language, you can create a file called `fr-fr.json` in the languages directory:

```shell
# Navigate to the ui/src/locale/languages directory
cd openmetadata-ui/src/main/resources/ui/src/locale/languages

# Create the French language file
touch fr-fr.json

```

## Sync the Language File with the Primary Language

Since we use `en-us` as our primary language, if you have added a new language file, you need to sync the newly added language file with the primary language. You can use the `i18n` script to achieve this.

```shell
yarn run i18n
```

## Update the `i18nextUtil.ts`

Now add the newly added language in `i18nextUtil.ts` , so that `i18next` can have the translation resource available.

```diff
import { InitOptions } from 'i18next';
import { map } from 'lodash';
import enUS from '../../locale/languages/en-us.json';
+ import frFR from '../../locale/languages/fr-fr.json';

export const getInitOptions = (): InitOptions => {
  return {
+   supportedLngs: ['en-US', 'fr-FR'],
    resources: {
      'en-US': { translation: enUS },
+     'fr-FR': { translation: frFR },
    },
    fallbackLng: ['en-US'],
```

## Test the language translation

To check the language translation functionality, please follow the steps outlined below:

1. Click on the language selection dropdown, and a list of available languages will appear.
2. Choose the language you wish to test, and the translation will be applied.

Please refer to the image below for assistance:

<Image alt="language-support" src="/images/how-to-guides/language-support.png"/>
