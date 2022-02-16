# Custom ORM Types

In this module we augment the types from SQLAlchemy to have a valid 1:1 mapping between OpenMetadata supported
`DataType` and SQLAlchemy results.

The process of augmenting types is done via the `TypeDecorator` abstract class. On our implementation we need to define
some functions:

- `process_bind_param`: How the data gets stored.
- `process_result_value`: How the data gets returned.
- `process_literal_param`: How we handle literal column creation.

It is interesting to add a validation step as well to make sure we are not allowing invalid data.
