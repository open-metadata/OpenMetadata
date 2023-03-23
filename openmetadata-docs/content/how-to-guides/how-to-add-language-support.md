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

To ensure consistency with our primary language, which is `en-us`, it is necessary to synchronize any newly added language files. This can be done by copying the content from the `en-us.json` file and translating it accordingly.
