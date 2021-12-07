---
description: >-
  This step by step guide will help you to generate typescript types from JSON
  schema.
---

# Generate Typescript Types From JSON Schema

We are using [quicktype](https://quicktype.io) to generate types from JSON Schema.

Make sure you have `quicktype` installed if not then install it using command given below from `openmetadata` root folder.

```
npm install
```

Now go to the UI folder `openmetadata-ui/src/main/resources/ui` and from there run the command given below.

```
npm run json2ts
```

The above command will take some time to execute and generate types.

After that, you can go to the generated `openmetadata-ui/src/main/resources/ui/src/generated/*` folder and see the all generated types.
