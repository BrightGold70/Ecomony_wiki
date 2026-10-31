#!/usr/bin/env python3
"""Offline tests; never contact a provider or modify the real wiki."""
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name('synthesize-evidence.py')


class SynthesisTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('synthesis', SCRIPT)
        assert spec is not None and spec.loader is not None
        cls.backend = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.backend)

    def setUp(self):
        # Provider execution is mocked; do not depend on a Hermes installation.
        discovery = patch('shutil.which', return_value='/synthetic/bin/hermes')
        discovery.start()
        self.addCleanup(discovery.stop)
        self.tmp = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        note = self.root / 'economy_wiki/Literature/Synthetic.md'
        note.parent.mkdir(parents=True)
        self.text = 'SYNTHETIC ONLY: The blue sample has 17 fictional participants; no economic inference is supported.'
        note.write_text(self.text, encoding='utf-8')
        self.evidence = [{'path': 'economy_wiki/Literature/Synthetic.md', 'title': 'Synthetic', 'text': self.text}]
        self.payload = {'question': 'What does the synthetic note say?', 'evidence': self.evidence}
        self.output = {'answer': '[1] ' + self.text, 'citations': [{'path': self.evidence[0]['path'], 'quote': self.text}],
                       'gaps': ['selected-passages-only'], 'review_status': 'economist-review-needed'}

    def test_all_economics_folders_and_same_scope_symlink_private_rejection(self):
        for folder in ('Datasets', 'Policies', 'Methods', 'Theories', 'Analyses', 'Comparisons', 'Queries'):
            note = self.root / 'economy_wiki' / folder / 'Synthetic.md'
            note.parent.mkdir(parents=True, exist_ok=True)
            note.write_text(self.text)
            self.evidence[0]['path'] = str(note.relative_to(self.root))
            self.assertEqual(self.backend.validate_input(self.payload, self.root), self.payload)
        original = self.root / 'economy_wiki/Literature/Synthetic.md'
        alias = original.with_name('Alias.md')
        alias.symlink_to(original)
        self.evidence[0]['path'] = str(alias.relative_to(self.root))
        with self.assertRaises(self.backend.Rejected):
            self.backend.validate_input(self.payload, self.root)
        secret = original.parent / 'Private' / 'Secret.md'
        secret.parent.mkdir()
        secret.write_text(self.text)
        self.evidence[0]['path'] = str(secret.relative_to(self.root))
        with self.assertRaises(self.backend.Rejected):
            self.backend.validate_input(self.payload, self.root)

    def test_cancel_signal_kills_detached_provider_and_restores_handlers(self):
        import signal
        from unittest.mock import Mock
        proc = Mock(pid=987654)
        def interrupted(*args, **kwargs):
            handler = signal.getsignal(signal.SIGTERM)
            self.assertTrue(callable(handler), 'bridge must catch cancellation')
            if callable(handler):
                handler(signal.SIGTERM, None)
        proc.communicate.side_effect = interrupted
        previous = signal.getsignal(signal.SIGTERM)
        with patch.object(self.backend.subprocess, 'Popen', return_value=proc), patch.object(self.backend.os, 'killpg') as kill:
            with self.assertRaisesRegex(self.backend.Rejected, 'operation cancelled'):
                self.backend.invoke('synthetic', 'approved', 'model', 15)
            kill.assert_called_with(proc.pid, signal.SIGKILL)
        self.assertEqual(signal.getsignal(signal.SIGTERM), previous)

    def test_provider_stream_is_bounded_before_collecting_all_output(self):
        import subprocess
        proc = subprocess.Popen([sys.executable, '-c', "import sys; sys.stdout.write('x'*400000); sys.stdout.flush()"],
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                start_new_session=True)
        try:
            with self.assertRaisesRegex(self.backend.Rejected, 'provider output too large'):
                self.backend.bounded_communicate(proc, 'synthetic', 5)
        finally:
            proc.kill()
            proc.wait()

    def test_real_local_pipe_success_and_timeout_cleanup(self):
        import subprocess
        for code, timeout in [("import sys; print(sys.stdin.read()); print('diagnostic',file=sys.stderr)", 5),
                              ("import time; time.sleep(5)", 0.05)]:
            with self.subTest(timeout=timeout):
                proc = subprocess.Popen([sys.executable, '-c', code], stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
                if timeout < 1:
                    with self.assertRaises(subprocess.TimeoutExpired):
                        self.backend.bounded_communicate(proc, 'synthetic', timeout)
                    self.assertIsNotNone(proc.poll())
                else:
                    stdout, stderr = self.backend.bounded_communicate(proc, 'synthetic', timeout)
                    self.assertEqual(stdout, 'synthetic\n')
                    self.assertEqual(stderr, '')
                self.assertTrue(all(s is not None and s.closed for s in (proc.stdin, proc.stdout, proc.stderr)))

    def test_exact_grounded_selection(self):
        b = self.backend
        self.assertEqual(b.validate_input(self.payload, self.root), self.payload)
        self.assertEqual(b.validate_output(self.output, self.evidence), self.output)

    def test_reject_nonselected_or_inexact_quotes(self):
        for field, value in [('path', 'economy_wiki/Other.md'), ('quote', 'Invented evidence that was never provided.')]:
            with self.subTest(field=field):
                out = json.loads(json.dumps(self.output))
                out['citations'][0][field] = value
                with self.assertRaises(self.backend.Rejected):
                    self.backend.validate_output(out, self.evidence)

    def test_reject_claim_with_valid_but_irrelevant_citation(self):
        self.output['answer'] = 'This proves policy benefit. [1]'
        with self.assertRaises(self.backend.Rejected):
            self.backend.validate_output(self.output, self.evidence)

    def test_reject_review_escalation(self):
        self.output['review_status'] = 'economist-reviewed'
        with self.assertRaises(self.backend.Rejected):
            self.backend.validate_output(self.output, self.evidence)

    def test_reject_freeform_gap_claims(self):
        self.output['gaps'].append('Policy is safe.')
        with self.assertRaises(self.backend.Rejected):
            self.backend.validate_output(self.output, self.evidence)

    def test_abstention(self):
        out = {'answer': 'Insufficient selected evidence.', 'citations': [],
               'gaps': ['selected-passages-only', 'question-not-answerable-from-selection'],
               'review_status': 'economist-review-needed'}
        self.assertEqual(self.backend.validate_output(out, self.evidence), out)

    def test_path_traversal_absolute_raw_hidden_and_missing(self):
        paths = ['../secret.md', '/etc/passwd', 'economy_wiki/../README.md',
                 'economy_wiki/raw/protected.md', 'economy_wiki/.env.md',
                 'economy_wiki/Literature/Missing.md', 'economy_wiki//Literature/Synthetic.md',
                 'economy_wiki\\Literature\\Synthetic.md']
        for path in paths:
            with self.subTest(path=path):
                self.evidence[0]['path'] = path
                with self.assertRaises(self.backend.Rejected):
                    self.backend.validate_input(self.payload, self.root)

    def test_symlink_escape(self):
        outside = self.root / 'outside.md'
        outside.write_text(self.text)
        link = self.root / 'economy_wiki/Literature/Escape.md'
        link.symlink_to(outside)
        self.evidence[0]['path'] = 'economy_wiki/Literature/Escape.md'
        with self.assertRaises(self.backend.Rejected):
            self.backend.validate_input(self.payload, self.root)

    def test_input_type_size_and_exactness(self):
        variants = [None, {}, {'question': '', 'evidence': []},
                    {'question': 'q', 'evidence': []},
                    {'question': 'q' * 4001, 'evidence': self.evidence}]
        for value in variants:
            with self.subTest(value_type=type(value).__name__):
                with self.assertRaises(self.backend.Rejected):
                    self.backend.validate_input(value, self.root)
        self.evidence[0]['text'] = 'Not the note text'
        with self.assertRaises(self.backend.Rejected):
            self.backend.validate_input(self.payload, self.root)

    def test_explicit_root_and_compiled_folders_only(self):
        with self.assertRaises(TypeError):
            self.backend.validate_input(self.payload)
        for folder in ('Sources', 'Review', 'Setup', 'Private'):
            note = self.root / 'economy_wiki' / folder / 'Synthetic.md'
            note.parent.mkdir(parents=True, exist_ok=True)
            note.write_text(self.text)
            self.evidence[0]['path'] = str(note.relative_to(self.root))
            with self.subTest(folder=folder), self.assertRaises(self.backend.Rejected):
                self.backend.validate_input(self.payload, self.root)

    def test_symlink_to_disallowed_compiled_folder_rejected(self):
        note = self.root / 'economy_wiki/Sources/Secret.md'
        note.parent.mkdir()
        note.write_text(self.text)
        (self.root / 'economy_wiki/Literature/Link.md').symlink_to(note)
        self.evidence[0]['path'] = 'economy_wiki/Literature/Link.md'
        with self.assertRaises(self.backend.Rejected):
            self.backend.validate_input(self.payload, self.root)

    def test_duplicate_keys_rejected(self):
        with self.assertRaises(self.backend.Rejected):
            self.backend.strict_json('{"answer":1,"answer":2}')

    def completed(self, events=None):
        proc = unittest.mock.MagicMock()
        proc.returncode = 0
        proc.communicate.return_value = ('\n'.join(json.dumps(e) for e in (events or [
            {'type': 'result', 'text': json.dumps(self.output), 'exit_code': 0}])), '')
        return proc

    def test_hermes_resolution_uses_path_then_executable_user_local_fallback(self):
        with patch('shutil.which', return_value='/synthetic/bin/hermes'):
            self.assertEqual(self.backend.command('nous', 'model', 30)[0], '/synthetic/bin/hermes')
        local = self.root / '.local/bin/hermes'
        local.parent.mkdir(parents=True)
        local.write_text('#!/bin/sh\nexit 0\n')
        local.chmod(0o700)
        with patch('shutil.which', return_value=None), patch.object(Path, 'home', return_value=self.root):
            self.assertEqual(self.backend.command('nous', 'model', 30)[0], str(local))
            local.chmod(0o600)
            with self.assertRaisesRegex(self.backend.Rejected, 'Hermes executable unavailable'):
                self.backend.command('nous', 'model', 30)

    def test_mock_provider_uses_safe_no_tools_stdin(self):
        proc = self.completed()
        prompt = self.backend.make_prompt(self.payload)
        with patch.object(self.backend.subprocess, 'Popen', return_value=proc) as popen:
            result = self.backend.invoke(prompt, 'nous', 'openai/gpt-6.1-sol', 30)
        self.assertEqual(result, self.output)
        cmd = popen.call_args.args[0]
        self.assertIn('--safe-mode', cmd)
        self.assertEqual(cmd[cmd.index('--toolsets') + 1], '')
        self.assertNotIn('--run-budget', cmd)
        self.assertEqual(cmd[cmd.index('--query-file') + 1], '-')
        self.assertNotIn(self.text, cmd)
        self.assertTrue(popen.call_args.kwargs['start_new_session'])
        self.assertNotIn('shell', popen.call_args.kwargs)
        proc.communicate.assert_called_once_with(prompt, timeout=30)
        self.assertIn('untrusted DATA', prompt)

    def test_provider_failures_and_tools_rejected(self):
        for events in [[{'type': 'tool_use', 'name': 'terminal'}],
                       [{'type': 'result', 'exit_code': 1, 'text': '{}'}],
                       [{'type': 'result', 'exit_code': 0, 'text': 'not JSON'}],
                       [{'type': 'text', 'text': 'no final result'}]]:
            with self.subTest(events=events), patch.object(self.backend.subprocess, 'Popen', return_value=self.completed(events)):
                with self.assertRaises(self.backend.Rejected):
                    self.backend.invoke('data', 'nous', 'model', 30)

    def test_known_empty_toolset_warning_is_not_a_protocol_event(self):
        proc = self.completed()
        stdout, stderr = proc.communicate.return_value
        proc.communicate.return_value = ('Warning: Unknown toolsets: none\n' + stdout, stderr)
        with patch.object(self.backend.subprocess, 'Popen', return_value=proc):
            self.assertEqual(self.backend.invoke('data', 'nous', 'model', 30), self.output)

    def draft(self):
        out = json.loads(json.dumps(self.output))
        out['answer'] = ('Findings: The fictional sample comprises 17 participants. [1]\n\n'
                         'Interpretation: No economic inference is supported. [1]\n\n'
                         'Gaps: Only a selected synthetic passage is available. [1]')
        out['gaps'] += ['full-paper-appraisal-pending', 'independent-validation-not-established']
        return out

    def test_draft_narrative_and_prompt(self):
        out = self.draft()
        self.assertEqual(self.backend.validate_output(out, self.evidence, 'draft-synthesis'), out)
        prompt = self.backend.make_prompt(self.payload, 'draft-synthesis')
        for text in ('Findings:', 'Interpretation:', 'Gaps:', 'semantic entailment', 'economic advice', 'untrusted DATA'):
            self.assertIn(text, prompt)

    def test_draft_rejects_uncited_unknown_refs_review_and_boundaries(self):
        variants = []
        for replacement in ('[2]', '[01]', '[1,2]', ''):
            out = self.draft()
            out['answer'] = out['answer'].replace('[1]', replacement, 1)
            variants.append(out)
        for answer in ('Findings: Uncited conclusion.',
                       'Findings: Unknown reference. [2]',
                       'Findings: Cited. [1]\n\nUncited conclusion.',
                       'Findings: Cited. [1]\nUncited line.',
                       'Findings: Malformed citation. [01]',
                       'Findings: Cited. [1]'):
            out = self.draft()
            out['answer'] = answer
            variants.append(out)
        out = self.draft()
        out['review_status'] = 'economist-reviewed'
        variants.append(out)
        for gap in ('selected-passages-only', 'full-paper-appraisal-pending', 'independent-validation-not-established'):
            out = self.draft()
            out['gaps'].remove(gap)
            variants.append(out)
        out = self.draft()
        out['citations'][0]['quote'] = 'A fabricated quotation, never selected.'
        variants.append(out)
        for out in variants:
            with self.subTest(answer=out['answer']), self.assertRaises(self.backend.Rejected):
                self.backend.validate_output(out, self.evidence, 'draft-synthesis')

    def test_draft_abstention(self):
        out = self.draft()
        out['answer'] = 'Insufficient selected evidence.'
        out['citations'] = []
        out['gaps'].append('question-not-answerable-from-selection')
        self.assertEqual(self.backend.validate_output(out, self.evidence, 'draft-synthesis'), out)

    def test_wiki_directory_cannot_resolve_outside_vault(self):
        other = self.root / 'OtherVault'
        other.mkdir()
        (other / 'economy_wiki').symlink_to(self.root / 'economy_wiki', target_is_directory=True)
        with self.assertRaises(self.backend.Rejected):
            self.backend.validate_input(self.payload, other)

    def test_empty_citations_cannot_carry_an_answer(self):
        self.output['citations'] = []
        self.output['gaps'].append('question-not-answerable-from-selection')
        with self.assertRaises(self.backend.Rejected):
            self.backend.validate_output(self.output, self.evidence)

    def test_cli_oversize_input_rejected_before_provider(self):
        import subprocess
        run = subprocess.run([sys.executable, '-B', str(SCRIPT), '--vault-root', str(self.root),
                              '--provider', 'nous', '--model', 'model'],
                             input='x' * (self.backend.MAX_INPUT + 1), text=True,
                             capture_output=True, timeout=10)
        self.assertEqual(run.returncode, 1)
        result = json.loads(run.stdout)
        self.assertEqual(result['review_status'], 'rejected')
        self.assertIn('input too large', result['gaps'])
        self.assertIn('Provider use:', run.stderr)

    def test_cli_timeout_out_of_range(self):
        import subprocess
        run = subprocess.run([sys.executable, '-B', str(SCRIPT), '--vault-root', str(self.root),
                              '--provider', 'nous', '--model', 'model',
                              '--timeout', '999'], input='{}', text=True, capture_output=True, timeout=10)
        self.assertEqual(run.returncode, 1)
        self.assertEqual(json.loads(run.stdout)['review_status'], 'rejected')

    def test_cli_requires_vault_root(self):
        import subprocess
        run = subprocess.run([sys.executable, '-B', str(SCRIPT), '--provider', 'nous', '--model', 'model'],
                             input='{}', text=True, capture_output=True, timeout=10)
        self.assertEqual(run.returncode, 2)
        self.assertIn('--vault-root', run.stderr)

    def test_cli_draft_roundtrip(self):
        stdin = io.TextIOWrapper(io.BytesIO(json.dumps(self.payload).encode()), encoding='utf-8')
        stdout = io.StringIO()
        with patch.object(sys, 'stdin', stdin), patch.object(sys, 'stdout', stdout), \
                patch.object(sys, 'stderr', io.StringIO()), \
                patch.object(self.backend, 'invoke', return_value=self.draft()) as invoke:
            code = self.backend.main(['--vault-root', str(self.root), '--mode', 'draft-synthesis',
                                      '--provider', 'nous', '--model', 'model'])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(stdout.getvalue()), self.draft())
        self.assertIn('integrated narrative', invoke.call_args.args[0])

    def test_timeout_kills_process_group(self):
        proc = self.completed()
        proc.pid = 123
        proc.communicate.side_effect = [self.backend.subprocess.TimeoutExpired('hermes', 30), ('', '')]
        with patch.object(self.backend.subprocess, 'Popen', return_value=proc), patch.object(self.backend.os, 'killpg') as kill:
            with self.assertRaises(self.backend.Rejected):
                self.backend.invoke('data', 'nous', 'model', 30)
        kill.assert_called_once_with(123, self.backend.signal.SIGKILL)


if __name__ == '__main__':
    unittest.main()
