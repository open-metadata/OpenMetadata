---
description: >-
  This step by step guide will help you to generate typescript types from JSON
  schema.
---

# Generate typescript types from JSON schema

We are using [quicktype](https://quicktype.io) to generate types from JSON Schema.

Install quicktype dependency globally using npm

```
npm install -g quicktype
```

Now go to the UI folder `src/main/resources/ui` and from there run the command given below.

```
npm run json2ts
```

The above command will take some time to execute and generate types.

After that, you can go to the generated `src/main/resources/ui/src/generated/*` folder and see the all generated types.
