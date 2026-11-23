import importlib.util,json,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1];s=importlib.util.spec_from_file_location('ppsf_gate',R/'content_gate.py');g=importlib.util.module_from_spec(s);s.loader.exec_module(g)
class ApprovedPpsfNormalizationTests(unittest.TestCase):
 def test_only_approved_signature_is_normalized(self):
  a='function moneyText(value = "") {';b='function moneyText(value = "", pricePerSqFt = false) {'
  for encode in (lambda v:v,lambda v:json.dumps(v)[1:-1]):
   self.assertEqual(g.normalized_embed(encode(a)),g.normalized_embed(encode(b)))
   self.assertNotEqual(g.normalized_embed(encode(a)),g.normalized_embed(encode(b.replace('false','true'))))
 def test_unapproved_currency_layout_and_text_remain_differences(self):
  for a,b in [('Math.round(n * scale)','Math.ceil(n * scale)'),('aa-main','aa-new'),('$1,097','$1,098')]:
   self.assertNotEqual(g.normalized_embed(a),g.normalized_embed(b))
