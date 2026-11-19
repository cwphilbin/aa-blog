"""Security-only regression checks; no content regeneration or remote requests."""
import importlib.util
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('security_gate',ROOT/'content_gate.py')
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)

class SecurityChecks(unittest.TestCase):
    def test_s3_object_identity_ignores_signing_parameters(self):
        query='?X-Amz-'+'Credential=expired&X-Amz-'+'Security-Token=expired'
        a=('https://bucket.s3.amazonaws.com/a/b.png'+query).encode()
        b=b'https://s3.us-east-2.amazonaws.com/bucket/a/b.png'
        self.assertEqual(gate.s3_references(a),b's3://bucket/a/b.png')
        self.assertEqual(gate.s3_references(a),gate.s3_references(b))
        self.assertNotEqual(gate.s3_references(a),gate.s3_references(b.replace(b'b.png',b'c.png')))
        self.assertEqual(gate.s3_references(b'https://example.com/?q=value'),b'https://example.com/?q=value')

    def test_embed_keeps_content_differences(self):
        a='<p>unchanged</p>https://bucket.s3.amazonaws.com/a.png'
        self.assertEqual(gate.normalized_embed(a),gate.normalized_embed(a.replace('https://bucket.s3.amazonaws.com/','s3://bucket/')))
        self.assertNotEqual(gate.normalized_embed(a),gate.normalized_embed(a.replace('unchanged','changed')))
        self.assertNotEqual(gate.normalized_embed(a),gate.normalized_embed(a.replace('a.png','b.png')))

    def test_temporary_inputs_keep_identical_bucket_key_and_original_bytes(self):
        with tempfile.TemporaryDirectory() as d:
            source=Path(d)/'source';source.mkdir();p=source/'report.json'
            raw=b'{"image":"s3://bucket/a.png","copy":"unchanged"}\n';p.write_bytes(raw)
            target=gate.render_input_copy(source,Path(d)/'target')
            self.assertEqual(p.read_bytes(),raw)
            self.assertEqual(gate.comparison_sha(p),gate.comparison_sha(target/p.name))

    def test_commit_hook_rejects_each_pattern_without_printing_values(self):
        values=[b'X-Amz-'+b'Credential=synthetic',b'X-Amz-'+b'Security-Token=synthetic',b'AS'+b'IA'+b'0'*16,b'AK'+b'IA'+b'0'*16]
        for value in values:
            with self.subTest(pattern=values.index(value)),tempfile.TemporaryDirectory() as d:
                repo=Path(d);subprocess.run(['git','init','-q',str(repo)],check=True)
                shutil.copytree(ROOT/'.githooks',repo/'.githooks')
                subprocess.run(['git','config','core.hooksPath','.githooks'],cwd=repo,check=True)
                p=repo/'sample.bin';p.write_bytes(b'\0'+value)
                subprocess.run(['git','add','sample.bin'],cwd=repo,check=True)
                result=subprocess.run(['git','-c','user.name=Security test','-c','user.email=test@example.invalid','commit','-qm','Guard test'],cwd=repo,capture_output=True)
                self.assertNotEqual(result.returncode,0)
                self.assertIn(b'Commit blocked',result.stderr)
                self.assertNotIn(value,result.stdout+result.stderr)
                p.write_bytes(b's3://bucket/a.png')
                subprocess.run(['git','add','sample.bin'],cwd=repo,check=True)
                result=subprocess.run(['git','-c','user.name=Security test','-c','user.email=test@example.invalid','commit','-qm','Clean identifier'],cwd=repo,capture_output=True)
                self.assertEqual(result.returncode,0,result.stderr)

if __name__=='__main__':unittest.main()
