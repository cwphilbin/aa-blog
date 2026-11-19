"""Build-path noise must compare equal without hiding customer output changes."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('embed_context_gate', ROOT / 'content_gate.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

MODULES = ('report-kit/site-header', 'neighborhoods', 'money',
           'report-kit/render', 'report-kit/controller', 'app')


class EmbedBuildContextTests(unittest.TestCase):
    def fixture(self, prefix, newline):
        comments = newline.join('  // ' + prefix + 'public/embed/' + name + '.js'
                                for name in MODULES) + newline
        return '<h1>Approved report</h1><a href="/market/90004">Report</a>' + comments + 'const approved = 1;'

    def test_only_known_comments_match_across_repository_working_directories(self):
        for newline in ('\n', '\\n'):
            original = self.fixture('../../../../../private/tmp/aa-neighborhoods-20261116/aa-blog/', newline)
            for prefix in ('', '../aa-blog/', '/private/tmp/other-build/aa-blog/'):
                with self.subTest(newline=repr(newline), prefix=prefix):
                    self.assertEqual(gate.normalized_embed(original),
                                     gate.normalized_embed(self.fixture(prefix, newline)))

    def test_markup_text_style_script_and_link_changes_still_fail(self):
        original = self.fixture('', '\\n') + '<style>.card{color:white}</style>'
        for before, after in (('Approved report', 'Changed report'),
                              ('<h1>', '<h2>'), ('color:white', 'color:gray'),
                              ('approved = 1', 'approved = 2'),
                              ('/market/90004', '/market/93536')):
            with self.subTest(before=before):
                self.assertNotEqual(gate.normalized_embed(original),
                                    gate.normalized_embed(original.replace(before, after)))

    def test_other_comment_paths_and_non_comment_text_are_not_ignored(self):
        for a, b in (('  // public/embed/other.js\n', '  // ../aa-blog/public/embed/other.js\n'),
                     ('<p>public/embed/money.js</p>', '<p>../aa-blog/public/embed/money.js</p>'),
                     ('  // unrelated/public/embed/money.js\n', '  // public/embed/money.js\n')):
            with self.subTest(a=a):
                self.assertNotEqual(gate.normalized_embed(a), gate.normalized_embed(b))
