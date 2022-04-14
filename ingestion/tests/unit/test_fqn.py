from unittest import TestCase

from metadata.utils import fqn


class Fqn(TestCase):
    def test_split(self):
        pass

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
