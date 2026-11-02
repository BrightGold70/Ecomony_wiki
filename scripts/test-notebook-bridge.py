#!/usr/bin/env python3
"""Offline synthetic fixtures only. No NotebookLM/provider calls or credentials."""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('notebook-bridge.py')


class FakeClient:
    """Synthetic in-memory async fixture, NOT a provider emulator/acceptance test."""
    def __init__(self):
        from types import SimpleNamespace
        self.obj = SimpleNamespace
        self.notebooks = self
        self.sources = FakeSources(self)
        self.created = 0
        self.fail_auth = False
        self.before_add = None

    async def list(self):
        if self.fail_auth:
            raise PermissionError('cookie=DO_NOT_LEAK token=SECRET')
        return [self.obj(id='fixture-notebook', title='Synthetic notebook')]

    async def get(self, notebook_id):
        if self.fail_auth:
            raise PermissionError('cookie=DO_NOT_LEAK token=SECRET')
        return self.obj(id=notebook_id, title='Synthetic notebook')

    async def create(self, title):
        self.created += 1
        return self.obj(id='new-fixture', title=title)


class FakeSources:
    def __init__(self, owner):
        self.owner = owner
        self.items = {}
        self.added = 0
        self.fail_wait = False
        self.fail_get = False
        self.fail_add = False
        self.bad_ready = False

    async def list(self, notebook_id, **kwargs):
        return list(self.items.values())

    async def add_text(self, notebook_id, title, content, **kwargs):
        self.added += 1
        if self.owner.before_add:
            self.owner.before_add()
        if self.fail_add:
            raise RuntimeError('private cookie')
        source = self.owner.obj(id='source-' + str(self.added), title=title, is_ready=True)
        self.items[source.id] = source
        return source

    async def add_file(self, notebook_id, file_path, **kwargs):
        assert Path(file_path).read_bytes().startswith(b'%PDF-')
        return await self.add_text(notebook_id, kwargs.get('title'), '', **{k:v for k,v in kwargs.items() if k != 'title'})

    async def wait_until_ready(self, notebook_id, source_id, **kwargs):
        if self.fail_wait:
            raise TimeoutError('secret')
        return self.owner.obj(id=source_id, is_ready=not self.bad_ready)

    async def get(self, notebook_id, source_id):
        if self.fail_get:
            return None
        return self.items.get(source_id)


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.vault = self.base / 'vault'
        self.state = self.base / 'state'
        self.note = self.vault / 'economy_wiki/Literature/a.md'
        self.note.parent.mkdir(parents=True)
        self.note.write_text('# SYNTHETIC fixture\n' + 'x' * 21000)
        if SCRIPT.exists():
            spec = importlib.util.spec_from_file_location('notebook_bridge', SCRIPT)
            self.bridge = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(self.bridge)
        else:
            self.bridge = None

    def call(self, request, client=None):
        self.assertIsNotNone(self.bridge, 'notebook bridge implementation missing')
        return asyncio.run(self.bridge.handle(request, self.vault, self.state, client=client))

    def preview(self, **kwargs):
        return self.call(dict(action='preview', paths=['economy_wiki/Literature/a.md'],
                              destination={'notebookId': 'fixture-notebook'}, **kwargs))

    def test_preview_is_local_bounded_and_private(self):
        result = self.preview()
        self.assertTrue(result['ok'])
        self.assertRegex(result['previewToken'], r'^[a-f0-9]{64}$')
        self.assertEqual(result['mode'], 'summary')
        self.assertEqual(result['files'][0]['characters'], 20000)
        self.assertEqual(result['destination'], {'notebookId': 'fixture-notebook'})
        self.assertEqual(os.stat(self.state).st_mode & 0o777, 0o700)
        for file in self.state.rglob('*'):
            self.assertEqual(file.stat().st_mode & 0o777, 0o700 if file.is_dir() else 0o600)


    def upload(self, token, client, **kwargs):
        return self.call(dict(action='upload', previewToken=token, consent=True, **kwargs), client)

    def test_explicit_upload_readback_and_verified_duplicate(self):
        client = FakeClient()
        preview = self.preview()
        token = preview['previewToken']
        denied = self.call(dict(action='upload', previewToken=token), client)
        self.assertFalse(denied['ok'])
        self.assertEqual(client.sources.added, 0)
        result = self.upload(token, client)
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['notebookId'], 'fixture-notebook')
        self.assertEqual(result['sources'][0]['status'], 'verified')
        second = self.upload(self.preview()['previewToken'], client)
        self.assertTrue(second['ok'], second)
        self.assertEqual(second['sources'][0]['status'], 'duplicate')
        self.assertEqual(client.sources.added, 1)
        receipts = [json.loads(p.read_text()) for p in (self.state / 'receipts').glob('*.json')]
        self.assertTrue(any(r.get('status') == 'verified' and r.get('previewToken') == token for r in receipts))


    def test_new_notebook_retry_reuses_durable_id_and_source(self):
        client = FakeClient()
        request = dict(action='preview', paths=['economy_wiki/Literature/a.md'], destination={'title': 'Synthetic new'})
        token = self.call(request)['previewToken']
        def inspect_before_add():
            receipt = json.loads((self.state / 'receipts' / (token + '.json')).read_text())
            self.assertEqual(receipt['notebookId'], 'new-fixture')
            self.assertEqual(receipt['destination'], {'title': 'Synthetic new'})
        client.before_add = inspect_before_add
        client.sources.fail_wait = True
        failed = self.upload(token, client)
        self.assertFalse(failed['ok'])
        self.assertEqual(failed['error']['code'], 'readiness_timeout')
        self.assertEqual(failed['status'], 'partial')
        client.sources.fail_wait = False
        self.assertTrue(self.upload(token, client)['ok'])
        self.assertEqual(client.created, 1)
        self.assertEqual(client.sources.added, 1)

    def test_tampered_bytes_and_destination_fail_before_provider(self):
        client = FakeClient()
        token = self.preview()['previewToken']
        self.note.write_text('changed synthetic bytes')
        result = self.upload(token, client)
        self.assertEqual(result['error']['code'], 'preview_changed')
        self.assertEqual(client.sources.added, 0)
        token = self.preview()['previewToken']
        manifest_path = self.state / 'manifests' / (token + '.json')
        manifest = json.loads(manifest_path.read_text())
        manifest['destination'] = {'notebookId': 'tampered'}
        manifest_path.write_text(json.dumps(manifest))
        self.assertEqual(self.upload(token, client)['error']['code'], 'preview_changed')

    def test_auth_failure_is_explicit_and_sanitized(self):
        client = FakeClient()
        client.fail_auth = True
        for request in [dict(action='list-notebooks'), dict(action='upload', consent=True, previewToken=self.preview()['previewToken'])]:
            result = self.call(request, client)
            self.assertFalse(result['ok'])
            self.assertEqual(result['error']['code'], 'auth_required')
            self.assertNotIn('DO_NOT_LEAK', json.dumps(result))
            self.assertNotIn('SECRET', json.dumps(result))

    def test_readback_and_not_ready_never_report_success(self):
        for flag in ('fail_get', 'bad_ready'):
            with self.subTest(flag=flag):
                client = FakeClient()
                setattr(client.sources, flag, True)
                result = self.upload(self.preview()['previewToken'], client)
                self.assertFalse(result['ok'])
                self.assertEqual(result['error']['code'], 'readback_failed')
                self.assertNotEqual(result['sources'][0]['status'], 'verified')

    def test_unknown_upload_outcome_not_blindly_retried(self):
        client = FakeClient()
        client.sources.fail_add = True
        token = self.preview()['previewToken']
        self.assertFalse(self.upload(token, client)['ok'])
        client.sources.fail_add = False
        self.assertEqual(self.upload(token, client)['error']['code'], 'outcome_unknown')
        self.assertEqual(client.sources.added, 1)

    def test_pdf_explicit_source_only_and_raw_bytes_pinned(self):
        source = self.vault / 'economy_wiki/Sources/s.md'
        source.parent.mkdir()
        raw = self.vault / 'economy_wiki/raw/s.pdf'
        raw.parent.mkdir()
        raw.write_bytes(b'%PDF-1.4\nSYNTHETIC PDF fixture')
        source.write_text('---\nraw_path: raw/s.pdf\n---\n# Synthetic source')
        req = dict(action='preview', mode='pdf', paths=['economy_wiki/Sources/s.md'], destination={'notebookId': 'pdf-fixture'})
        result = self.call(req)
        self.assertTrue(result['ok'], result)
        client = FakeClient()
        self.assertTrue(self.upload(result['previewToken'], client)['ok'])
        raw.write_bytes(b'%PDF-1.4\nchanged synthetic')
        self.assertEqual(self.upload(result['previewToken'], client)['error']['code'], 'preview_changed')
        source.write_text('---\nraw_path: ../Personal/private.pdf\n---\n')
        self.assertFalse(self.call(req)['ok'])
        self.assertFalse(self.preview(mode='pdf')['ok'])

    def test_path_limits_hidden_private_symlinks_and_state_inside_vault(self):
        for path in ('../Personal/a.md', '/etc/passwd', 'economy_wiki/Literature/../Topics/a.md',
                     'economy_wiki/Literature/.private.md', 'economy_wiki/Literature/private/a.md',
                     'economy_wiki/Literature/a\\b.md', 'economy_wiki/Sources/a.md'):
            with self.subTest(path=path):
                result = self.call(dict(action='preview', paths=[path], destination={'title': 'Synthetic'}))
                self.assertFalse(result['ok'])
        linked = self.note.with_name('link.md')
        linked.symlink_to(self.note)
        self.assertFalse(self.call(dict(action='preview', paths=['economy_wiki/Literature/link.md'], destination={'title': 'Synthetic'}))['ok'])
        self.assertFalse(self.call(dict(action='preview', paths=['economy_wiki/Literature/a.md'] * 21, destination={'title': 'Synthetic'}))['ok'])
        result = asyncio.run(self.bridge.handle(dict(action='list-notebooks'), self.vault, self.vault / 'state', client=FakeClient()))
        self.assertEqual(result['error']['code'], 'unsafe_state')


    def test_lazy_runtime_uses_only_isolated_auth_env(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        client = FakeClient()
        observed = []
        class Context:
            async def __aenter__(inner):
                return client
            async def __aexit__(inner, *args):
                return False
        def from_storage(**kwargs):
            observed.append((os.environ.get('NOTEBOOKLM_HOME'), kwargs))
            return Context()
        isolated = self.state / 'auth'
        # Synthetic module injection: no SDK import and no account access.
        private_auth = self.state / 'auth/profiles/default'
        private_auth.mkdir(parents=True)
        (private_auth / 'storage_state.json').write_text('{"synthetic":true}')
        (private_auth / 'storage_state.json').chmod(0o600)
        with patch.dict('sys.modules', {'notebooklm': SimpleNamespace(NotebookLMClient=SimpleNamespace(from_storage=from_storage))}):
            result = self.call(dict(action='list-notebooks'))
        self.assertTrue(result['ok'], result)
        self.assertEqual(observed[0][0], str(isolated))
        self.assertEqual(observed[0][1]['path'], str(isolated / 'profiles/default/storage_state.json'))
        self.assertEqual(observed[0][1]['rate_limit_max_retries'], 0)
        self.assertEqual(os.stat(isolated).st_mode & 0o777, 0o700)

    def test_dependency_missing_is_safe_and_preview_needs_no_import(self):
        from unittest.mock import patch
        with patch.dict('sys.modules', {'notebooklm': None}):
            self.assertTrue(self.preview()['ok'])
            result = self.call(dict(action='list-notebooks'))
            self.assertEqual(result['error']['code'], 'dependency_missing')


    def test_missing_isolated_auth_never_enters_client(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        def forbidden(**kwargs):
            self.fail('Missing auth must not instantiate or access provider')
        with patch.dict('sys.modules', {'notebooklm': SimpleNamespace(NotebookLMClient=SimpleNamespace(from_storage=forbidden))}):
            result = self.call(dict(action='list-notebooks'))
        self.assertEqual(result['error']['code'], 'auth_required')

    def test_active_upload_lock_blocks_duplicate_submission(self):
        import fcntl
        token = self.preview()['previewToken']
        lock = self.state / 'upload.lock'
        with lock.open('w') as stream:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = self.upload(token, FakeClient())
        self.assertEqual(result['error']['code'], 'busy')


    def test_env_auth_and_refresh_cannot_override_isolated_account(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        auth = self.state / 'auth/profiles/default'
        auth.mkdir(parents=True)
        (auth / 'storage_state.json').write_text('{"synthetic":true}')
        (auth / 'storage_state.json').chmod(0o600)
        checked = []
        class Context:
            async def __aenter__(inner):
                checked.append(True)
                self.assertNotIn('NOTEBOOKLM_AUTH_JSON', os.environ)
                self.assertNotIn('NOTEBOOKLM_REFRESH_CMD', os.environ)
                self.assertNotIn('NOTEBOOKLM_PROFILE', os.environ)
                return FakeClient()
            async def __aexit__(inner, *args):
                return False
        module = SimpleNamespace(NotebookLMClient=SimpleNamespace(from_storage=lambda **kw: Context()))
        with patch.dict(os.environ, {'NOTEBOOKLM_AUTH_JSON': 'SYNTHETIC', 'NOTEBOOKLM_REFRESH_CMD': 'forbidden', 'NOTEBOOKLM_PROFILE': 'other'}):
            with patch.dict('sys.modules', {'notebooklm': module}):
                self.assertTrue(self.call(dict(action='list-notebooks'))['ok'])
        self.assertEqual(checked, [True])

    def test_remote_list_response_and_per_notebook_dedup_scope(self):
        client = FakeClient()
        self.assertEqual(self.call(dict(action='list-notebooks'), client)['notebooks'],
                         [{'notebookId': 'fixture-notebook', 'title': 'Synthetic notebook'}])
        self.assertTrue(self.upload(self.preview()['previewToken'], client)['ok'])
        req = dict(action='preview', paths=['economy_wiki/Literature/a.md'], destination={'notebookId': 'second-fixture'})
        self.assertTrue(self.upload(self.call(req)['previewToken'], client)['ok'])
        self.assertEqual(client.sources.added, 2)

    def test_pdf_limit_and_duplicate_json_rejected(self):
        raw = self.vault / 'economy_wiki/raw/big.pdf'
        raw.parent.mkdir()
        with raw.open('wb') as stream:
            stream.write(b'%PDF-1.4')
            stream.truncate(100 * 1024 * 1024 + 1)
        source = self.vault / 'economy_wiki/Sources/big.md'
        source.parent.mkdir()
        source.write_text('---\nraw_path: raw/big.pdf\n---\n')
        req = dict(action='preview', mode='pdf', paths=['economy_wiki/Sources/big.md'], destination={'title': 'Synthetic'})
        self.assertEqual(self.call(req)['error']['code'], 'file_limit')
        with self.assertRaises(self.bridge.Rejected):
            self.bridge.strict_json('{"action":"preview","action":"upload"}')

    def test_cli_preview_json_exit_codes_without_dependency(self):
        import subprocess
        import sys
        command = [sys.executable, '-B', str(SCRIPT), '--vault-root', str(self.vault), '--state-dir', str(self.state)]
        result = subprocess.run(command, input=json.dumps(dict(action='preview', paths=['economy_wiki/Literature/a.md'], destination={'title': 'Synthetic'})), text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)['ok'])
        self.assertEqual(result.stderr, '')
        result = subprocess.run(command, input='{"action":"upload","consent":false}', text=True, capture_output=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)['error']['code'], 'consent_required')


    def test_state_cannot_be_ancestor_and_notebook_readback_must_match(self):
        result = asyncio.run(self.bridge.handle(dict(action='list-notebooks'), self.vault, self.base, client=FakeClient()))
        self.assertEqual(result['error']['code'], 'unsafe_state')
        client = FakeClient()
        async def wrong_notebook(notebook_id):
            return client.obj(id='wrong-notebook')
        client.get = wrong_notebook
        result = self.upload(self.preview()['previewToken'], client)
        self.assertEqual(result['error']['code'], 'readback_failed')
        self.assertEqual(client.sources.added, 0)

    def test_unknown_notebook_create_does_not_create_again(self):
        client = FakeClient()
        async def uncertain_create(title):
            client.created += 1
            raise TimeoutError('synthetic ambiguous create failure')
        client.create = uncertain_create
        req = dict(action='preview', paths=['economy_wiki/Literature/a.md'], destination={'title': 'Synthetic'})
        token = self.call(req)['previewToken']
        self.assertFalse(self.upload(token, client)['ok'])
        self.assertEqual(self.upload(token, client)['error']['code'], 'outcome_unknown')
        self.assertEqual(client.created, 1)

    def test_source_absent_from_list_cannot_be_verified(self):
        client = FakeClient()
        async def empty_list(notebook_id):
            return []
        client.sources.list = empty_list
        result = self.upload(self.preview()['previewToken'], client)
        self.assertEqual(result['error']['code'], 'readback_failed')


    def test_wait_is_bounded_even_if_client_waiter_ignores_timeout(self):
        client = FakeClient()
        async def stuck(*args, **kwargs):
            await asyncio.sleep(1)
        client.sources.wait_until_ready = stuck
        self.bridge.TIMEOUT = 0.001
        result = self.upload(self.preview()['previewToken'], client)
        self.assertEqual(result['error']['code'], 'readiness_timeout')


    def test_summary_accepts_all_nine_compiled_economics_folders(self):
        folders = ('Literature', 'Topics', 'Datasets', 'Policies', 'Methods',
                   'Theories', 'Analyses', 'Comparisons', 'Queries')
        paths = []
        for folder in folders:
            note = self.vault / 'economy_wiki' / folder / 'economics.md'
            note.parent.mkdir(parents=True, exist_ok=True)
            note.write_text('# SYNTHETIC economics: economist-review-needed')
            paths.append(note.relative_to(self.vault).as_posix())
        result = self.call(dict(action='preview', paths=paths,
                                destination={'title': 'Synthetic economics'}))
        self.assertTrue(result['ok'], result)
        self.assertEqual({f['path'] for f in result['files']}, set(paths))

    def test_summary_rejects_noncompiled_and_other_namespace(self):
        for folder in ('Sources', 'raw', 'Review', 'Setup', 'Private'):
            note = self.vault / 'economy_wiki' / folder / 'synthetic.md'
            note.parent.mkdir(parents=True, exist_ok=True)
            note.write_text('SYNTHETIC not compiled')
            result = self.call(dict(action='preview', paths=[note.relative_to(self.vault).as_posix()],
                                    destination={'title': 'Synthetic economics'}))
            self.assertFalse(result['ok'], folder)
        other = self.vault / 'other_wiki/Literature/synthetic.md'
        other.parent.mkdir(parents=True)
        other.write_text('SYNTHETIC unrelated namespace')
        self.assertFalse(self.call(dict(action='preview', paths=[other.relative_to(self.vault).as_posix()],
                                       destination={'title': 'Synthetic economics'}))['ok'])

    def test_pdf_raw_path_boundary_and_symlinks(self):
        source = self.vault / 'economy_wiki/Sources/economics.md'
        source.parent.mkdir()
        raw = self.vault / 'economy_wiki/raw/synthetic.pdf'
        raw.parent.mkdir()
        raw.write_bytes(b'%PDF-1.4 SYNTHETIC economics')
        escaped = self.vault / 'economy_wiki/Literature/outside.pdf'
        escaped.write_bytes(raw.read_bytes())
        linked = raw.with_name('linked.pdf')
        linked.symlink_to(raw)
        hidden = raw.with_name('.hidden.pdf')
        hidden.write_bytes(raw.read_bytes())
        request = dict(action='preview', mode='pdf', paths=['economy_wiki/Sources/economics.md'],
                       destination={'title': 'Synthetic economics'})
        for path in ('../Literature/outside.pdf', 'Literature/outside.pdf', 'raw/../Literature/outside.pdf',
                     'raw/linked.pdf', 'raw/.hidden.pdf', str(raw), 'https://invalid.example/synthetic.pdf'):
            source.write_text('---\nraw_path: ' + path + '\n---\nSYNTHETIC')
            self.assertFalse(self.call(request)['ok'], path)
        source.write_text('---\nraw_path: raw/synthetic.pdf\n---\nSYNTHETIC')
        result = self.call(request)
        self.assertTrue(result['ok'], result)
        self.assertFalse(self.call(dict(request, paths=['economy_wiki/raw/synthetic.pdf']))['ok'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
