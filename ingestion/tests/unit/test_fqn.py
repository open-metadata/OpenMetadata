from unittest import TestCase

from metadata.utils import fqn


class Fqn(TestCase):
    def test_split(self):
        this = self

        class FQNTest:
            def __init__(self, parts, fqn):
                self.parts = parts
                self.fqn = fqn

            def validate(self, actual_parts, actual_fqn):
                this.assertEqual(self.fqn, actual_fqn)
                this.assertEqual(len(self.parts), len(actual_parts))

                for i in range(len(self.parts)):
                    if "." in self.parts[i]:
                        this.assertEqual(
                            fqn.quote_name(self.parts[i]), actual_parts[i]
                        )
                    else:
                        this.assertEqual(self.parts[i], actual_parts[i])

        xs = [
            FQNTest(["a", "b", "c", "d"], "a.b.c.d"),
            FQNTest(["a.1", "b", "c", "d"], '"a.1".b.c.d'),
            FQNTest(["a", "b.2", "c", "d"], 'a."b.2".c.d'),
            FQNTest(["a", "b", "c.3", "d"], 'a.b."c.3".d'),
            FQNTest(["a", "b", "c", "d.4"], 'a.b.c."d.4"'),
            FQNTest(["a.1", "b.2", "c", "d"], '"a.1"."b.2".c.d'),
            FQNTest(["a.1", "b.2", "c.3", "d"], '"a.1"."b.2"."c.3".d'),
            FQNTest(["a.1", "b.2", "c.3", "d.4"], '"a.1"."b.2"."c.3"."d.4"'),
        ]
        for x in xs:
            actual_parts = fqn.split(x.fqn)
            actual_fqn = fqn.build(*x.parts)
            x.validate(actual_parts, actual_fqn)

    def test_quote_name(self):
        # Unquote_named name remains unquote_named
        self.assertEqual("a", fqn.quote_name("a"))
        # Add quote_names when "." exists in the name
        self.assertEqual('"a.b"', fqn.quote_name("a.b"))
        # Leave existing valid quote_names
        self.assertEqual('"a.b"', fqn.quote_name('"a.b"'))
        # Remove quote_names when not needed
        self.assertEqual("a", fqn.quote_name('"a"'))

        with self.assertRaises(Exception) as context:
            fqn.quote_name('"a')
        self.assertEqual('Invalid name "a', str(context.exception))
        with self.assertRaises(Exception) as context:
            fqn.quote_name('a"')
        self.assertEqual('Invalid name a"', str(context.exception))
        with self.assertRaises(Exception) as context:
            fqn.quote_name('a"b')
        self.assertEqual('Invalid name a"b', str(context.exception))
