# Ontology round-trip fidelity corpus

These RDF/XML fixtures are copied verbatim from the `catalogue/external` directory of
[`microsoft/Ontology-Playground`](https://github.com/microsoft/Ontology-Playground) at commit
`683adcc8d5a449b9ca9c82e92aaf51c066025c25`.

They cover three deliberately different modeling profiles:

- FIBO: enterprise classes, object properties, annotations, and datatype properties.
- Schema.org: datatype properties reused across domain classes.
- Pizza: compact OWL class and relationship modeling.

The upstream corpus is licensed under the MIT License, Copyright Microsoft Corporation. The
license notice is retained here because these fixtures are substantial copies:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software
> and associated documentation files (the "Software"), to deal in the Software without
> restriction, including without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
> Software is furnished to do so, subject to the conditions in the upstream MIT License.

The fixtures are test ground truth. Do not normalize or regenerate them in place.
