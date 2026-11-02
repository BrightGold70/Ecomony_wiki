#!/usr/bin/env python3
"""Optional NotebookLM bridge (Python >=3.11, stdlib-only for preview).

CLI: python notebook-bridge.py --vault-root PARENT --state-dir EXTERNAL
One JSON request on stdin; one JSON response on stdout; exit 0 on ok, 1 on error.
Paths are vault-relative, starting economy_wiki/. No discovery or link expansion.
Requests (unknown/duplicate fields rejected):
  {"action":"list-notebooks"}
  {"action":"preview","paths":["economy_wiki/Literature/a.md"],
   "mode":"summary", "destination":{"notebookId":"explicit-id"}}
  mode defaults to summary; destination may instead be {"title":"New notebook"}.
  PDF mode paths MUST select Sources/*.md with a plain raw_path: raw/...pdf.
  {"action":"upload","previewToken":"64 lowercase hex","consent":true}
Responses: {ok:true,action,...}; preview includes previewToken,mode,destination,
files:[{path,rawPath?,sourceHash,originalHash,bytes,characters?,text?}],totalBytes.
list-notebooks includes notebooks:[{notebookId,title}]. upload includes
previewToken,destination,notebookId,status, sources:[{sourceHash,sourceId,status}],
where status is verified and each source is verified or duplicate.
Errors: {ok:false,error:{code,message},action?,previewToken?,notebookId?,sources?}.
Partial remote failures additionally return status:partial; saved receipts govern
retry. Unknown create/upload outcomes are NOT blindly retried (manual inspection
needed). No delete, share, global notebook context, browser or login operations.

Install notebooklm-py into a SEPARATE venv and run this file with that Python.
Remote actions set NOTEBOOKLM_HOME=<state-dir>/auth BEFORE lazy import. Login is
an independent USER action, using that same isolated venv and environment:
  NOTEBOOKLM_HOME=<external-state-dir>/auth NOTEBOOKLM_PROFILE=default <venv>/bin/notebooklm login
Auth is pinned to auth/profiles/default/storage_state.json (private mode 0600).
Never migrate/copy existing auth. Preview needs neither dependency nor login.
Unofficial Google API: subject to upstream changes, not economist approval or permission to transmit restricted research data.
API inspected via gh: teng-lin/notebooklm-py commit
7db1000b516c3f3a7d3afe7c4c572924ee7a5264 docs/python-api.md, _sources.py;
production adapter follows notebooklm-py 0.8.6 managed from_storage API.
Tests inject an async fake; no provider acceptance is implied.
"""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import stat
import sys

MAX_FILES = 20
MAX_BYTES = 100 * 1024 * 1024
SUMMARY_CHARS = 20000
TIMEOUT = 120
COMPILED_FOLDERS = frozenset({'Literature', 'Topics', 'Datasets', 'Policies', 'Methods',
                              'Theories', 'Analyses', 'Comparisons', 'Queries'})


class Rejected(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message


def require(value, code='invalid_request', message='Request rejected.'):
    if not value:
        raise Rejected(code, message)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def strict_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result)
            result[key] = value
        return result
    return json.loads(text, object_pairs_hook=pairs,
                      parse_constant=lambda _: require(False))


def relative_parts(value):
    require(isinstance(value, str) and len(value) <= 2048)
    parts = value.split('/')
    require(all(p and not p.startswith('.') and p.casefold() not in
                {'private', 'personal', 'confidential', 'secrets', 'auth'} for p in parts)
            and not re.search(r'[\\\x00-\x1f\x7f]', value),
            'unsafe_path', 'Only explicit non-private wiki paths are allowed.')
    return parts


def selected_bytes(vault, value, folders, suffix):
    parts = relative_parts(value)
    require(len(parts) >= 3 and parts[0] == 'economy_wiki' and parts[1] in folders
            and parts[-1].lower().endswith(suffix), 'unsafe_path', 'Path is outside the allowed selection.')
    # Descriptor-relative traversal rejects symlinks including parent components;
    # reads the selected file only, never walks or inventories the vault.
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        absolute = Path(vault).absolute().parts[1:] + tuple(parts)
        for part in absolute[:-1]:
            next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        file_fd = os.open(absolute[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
        with os.fdopen(file_fd, 'rb') as stream:
            info = os.fstat(stream.fileno())
            require(stat.S_ISREG(info.st_mode) and info.st_size <= MAX_BYTES,
                    'file_limit', 'Selected file is unavailable or too large.')
            data = stream.read(MAX_BYTES + 1)
            require(len(data) <= MAX_BYTES, 'file_limit', 'Selected file is too large.')
            return data
    finally:
        os.close(fd)


def private_dir(path):
    # Reject symlinks even in pre-existing ancestors; do not touch other auth.
    path = Path(path).absolute()
    for parent in reversed((path, *path.parents)):
        if parent.exists() or parent.is_symlink():
            require(not parent.is_symlink() and parent.is_dir(), 'unsafe_state', 'Unsafe state directory.')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    require(path.stat().st_uid == os.getuid(), 'unsafe_state', 'State ownership mismatch.')
    os.chmod(path, 0o700)
    return path


def save(path, value):
    data = canonical(value)
    temporary = path.with_name('.' + path.name + '.' + secrets.token_hex(8))
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        require(not path.is_symlink(), 'unsafe_state', 'Unsafe state file.')
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


def load(path):
    require(not path.is_symlink() and path.is_file() and path.stat().st_uid == os.getuid()
            and path.stat().st_mode & 0o077 == 0, 'unsafe_state', 'Private state file unavailable.')
    return strict_json(path.read_text())


def destination(value):
    require(isinstance(value, dict) and set(value) in ({'notebookId'}, {'title'}))
    key = next(iter(value))
    text = value[key]
    require(isinstance(text, str) and text.strip() == text and 0 < len(text) <= 200
            and not re.search(r'[\x00-\x1f\x7f]', text))
    if key == 'notebookId':
        require(re.fullmatch(r'[A-Za-z0-9_-]+', text))
    return dict(value)


def preview(request, vault, state):
    require(set(request) <= {'action', 'paths', 'mode', 'destination'})
    target = destination(request.get('destination'))
    mode = request.get('mode', 'summary')
    require(mode in ('summary', 'pdf'))
    paths = request.get('paths')
    require(isinstance(paths, list) and 1 <= len(paths) <= MAX_FILES
            and all(isinstance(p, str) for p in paths) and len(set(paths)) == len(paths),
            'file_limit', 'Select 1 to 20 distinct explicit paths.')
    files, total, originals = [], 0, 0
    for path in paths:
        data = selected_bytes(vault, path, COMPILED_FOLDERS if mode == 'summary' else {'Sources'}, '.md')
        originals += len(data)
        entry = {'path': path, 'originalHash': digest(data)}
        text = data.decode('utf-8')
        if mode == 'summary':
            text = text[:SUMMARY_CHARS]
            data = text.encode('utf-8')
            entry.update(text=text, characters=len(text))
        else:
            front = re.match(r'\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)', text, re.S)
            matches = re.findall(r'^raw_path:[ \t]*(.*?)[ \t]*\r?$', front[1] if front else '', re.M)
            require(len(matches) == 1, 'unsafe_path', 'PDF requires one explicit Sources raw_path.')
            raw = matches[0]
            if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
                raw = raw[1:-1]
            require(raw.startswith('raw/'), 'unsafe_path', 'PDF raw_path must be within wiki raw/.')
            raw = 'economy_wiki/' + raw
            data = selected_bytes(vault, raw, {'raw'}, '.pdf')
            require(data.startswith(b'%PDF-'), 'invalid_pdf', 'Selected raw file is not a PDF.')
            entry['rawPath'] = raw
        entry.update(sourceHash=digest(data), bytes=len(data))
        total += len(data)
        require(total <= MAX_BYTES and originals <= MAX_BYTES, 'file_limit', 'Selection exceeds 100 MB.')
        files.append(entry)
    manifest = dict(version=1, vault=str(Path(vault).absolute()), nonce=secrets.token_hex(32),
                    mode=mode, destination=target, files=files, totalBytes=total)
    token = digest(canonical(manifest))
    save(state / 'manifests' / (token + '.json'), manifest)
    return dict(ok=True, action='preview', previewToken=token, mode=mode,
                destination=target, files=files, totalBytes=total)


def remote_error(exc):
    name = type(exc).__name__.lower()
    if isinstance(exc, PermissionError) or any(s in name for s in ('auth', 'login', 'cookie', 'sessionexpired')):
        return dict(code='auth_required', message='Isolated NotebookLM login required; run login separately with NOTEBOOKLM_HOME set to state-dir/auth.')
    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)) or 'timeout' in name:
        return dict(code='readiness_timeout', message='Remote operation timed out; inspect receipts before retry.')
    return dict(code='remote_failure', message='Remote operation or readback failed; inspect receipts before retry.')


def identifier(obj):
    value = getattr(obj, 'id', None)
    require(isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_-]{1,200}', value),
            'readback_failed', 'Remote identifier unavailable.')
    return value


async def verified_source(client, notebook_id, source_id):
    ready = await asyncio.wait_for(
        client.sources.wait_until_ready(notebook_id, source_id, timeout=TIMEOUT), timeout=TIMEOUT)
    require(identifier(ready) == source_id and getattr(ready, 'is_ready', False) is True,
            'readback_failed', 'Source readiness not verified.')
    sources = await client.sources.list(notebook_id)
    require(source_id in {identifier(s) for s in sources}, 'readback_failed', 'Source absent from remote listing.')
    source = await client.sources.get(notebook_id, source_id)
    require(identifier(source) == source_id and getattr(source, 'is_ready', False) is True,
            'readback_failed', 'Source readback not ready.')


def pinned_manifest(request, vault, state):
    require(set(request) == {'action', 'previewToken', 'consent'} and request['consent'] is True,
            'consent_required', 'Upload requires previewToken and explicit consent true.')
    token = request['previewToken']
    require(isinstance(token, str) and re.fullmatch('[a-f0-9]{64}', token))
    manifest = load(state / 'manifests' / (token + '.json'))
    require(digest(canonical(manifest)) == token and manifest['vault'] == str(vault),
            'preview_changed', 'Preview binding mismatch; preview again.')
    payloads = []
    for item in manifest['files']:
        data = selected_bytes(vault, item['path'], COMPILED_FOLDERS if manifest['mode'] == 'summary' else {'Sources'}, '.md')
        require(digest(data) == item['originalHash'], 'preview_changed', 'Selected bytes changed; preview again.')
        if manifest['mode'] == 'summary':
            data = data.decode('utf-8')[:SUMMARY_CHARS].encode('utf-8')
        else:
            data = selected_bytes(vault, item['rawPath'], {'raw'}, '.pdf')
        require(digest(data) == item['sourceHash'] and len(data) == item['bytes'],
                'preview_changed', 'Selected bytes changed; preview again.')
        payloads.append(data)
    return token, manifest, payloads


async def upload(client, token, manifest, payloads, state):
    receipt_path = state / 'receipts' / (token + '.json')
    receipt = load(receipt_path) if receipt_path.exists() else dict(
        version=1, previewToken=token, destination=manifest['destination'],
        mode=manifest['mode'], notebookId=None, status='pending', sources=[])
    require(receipt['previewToken'] == token and receipt['destination'] == manifest['destination']
            and receipt['mode'] == manifest['mode'], 'preview_changed', 'Receipt binding mismatch.')
    try:
        if not receipt['notebookId']:
            if 'notebookId' in manifest['destination']:
                receipt['notebookId'] = manifest['destination']['notebookId']
                save(receipt_path, receipt)
            else:
                require(receipt['status'] != 'creating', 'outcome_unknown',
                        'Notebook creation outcome unknown; manual reconciliation required.')
                receipt['status'] = 'creating'
                save(receipt_path, receipt)
                notebook = await client.notebooks.create(manifest['destination']['title'])
                receipt['notebookId'] = identifier(notebook)
                receipt['status'] = 'created'
                save(receipt_path, receipt)  # durable BEFORE any source upload
        notebook_id = receipt['notebookId']
        require(identifier(await client.notebooks.get(notebook_id)) == notebook_id,
                'readback_failed', 'Notebook readback mismatch.')
        # Only verified local receipts authorize content-hash deduplication.
        known = {}
        for path in (state / 'receipts').glob('*.json'):
            previous = load(path)
            if previous.get('notebookId') == notebook_id:
                for source in previous.get('sources', []):
                    if source.get('status') in ('verified', 'duplicate') and source.get('sourceId'):
                        known[source['sourceHash']] = source['sourceId']
        for item, data in zip(manifest['files'], payloads):
            source = next((s for s in receipt['sources'] if s['sourceHash'] == item['sourceHash']), None)
            if source is None:
                source = dict(sourceHash=item['sourceHash'], sourceId=None, status='pending')
                receipt['sources'].append(source)
            if source['sourceHash'] in known:
                source['sourceId'] = known[source['sourceHash']]
                await verified_source(client, notebook_id, source['sourceId'])
                source['status'] = 'duplicate'
            else:
                require(source['sourceId'] is not None or source['status'] != 'uploading',
                        'outcome_unknown', 'Source upload outcome unknown; manual reconciliation required.')
                if not source['sourceId']:
                    source['status'] = 'uploading'
                    save(receipt_path, receipt)
                    title = 'wiki-' + item['sourceHash'][:16] + '-' + Path(item['path']).stem
                    if manifest['mode'] == 'summary':
                        added = await client.sources.add_text(notebook_id, title, data.decode('utf-8'), wait=False)
                    else:
                        payload = state / 'payloads' / (item['sourceHash'] + '.pdf')
                        fd = os.open(payload, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
                        try:
                            with os.fdopen(fd, 'wb') as stream:
                                stream.write(data)
                            added = await client.sources.add_file(notebook_id, payload, mime_type='application/pdf', wait=False, title=title)
                        finally:
                            payload.unlink(missing_ok=True)
                    source['sourceId'] = identifier(added)
                    source['status'] = 'processing'
                    save(receipt_path, receipt)
                await verified_source(client, notebook_id, source['sourceId'])
                source['status'] = 'verified'
                known[source['sourceHash']] = source['sourceId']
            save(receipt_path, receipt)
        receipt['status'] = 'verified'
        save(receipt_path, receipt)
        return dict(ok=True, action='upload', previewToken=token, destination=manifest['destination'],
                    notebookId=notebook_id, status='verified', sources=receipt['sources'])
    except Exception as exc:
        # Preserve creating/uploading uncertainty and any known ids on failure.
        receipt['lastError'] = dict(code=exc.code, message=exc.message) if isinstance(exc, Rejected) else remote_error(exc)
        if receipt['status'] != 'creating':
            receipt['status'] = 'partial'
        save(receipt_path, receipt)
        return dict(ok=False, action='upload', previewToken=token, notebookId=receipt['notebookId'],
                    status='partial', sources=receipt['sources'], error=receipt['lastError'])


async def remote_action(request, vault, state, client):
    if request['action'] == 'list-notebooks':
        require(set(request) == {'action'})
        notebooks = await client.notebooks.list()
        return dict(ok=True, action='list-notebooks', notebooks=[
            dict(notebookId=identifier(n), title=n.title) for n in notebooks])
    token, manifest, payloads = pinned_manifest(request, vault, state)
    import fcntl
    fd = os.open(state / 'upload.lock', os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        os.fchmod(fd, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Rejected('busy', 'Another upload is in progress.') from None
        return await upload(client, token, manifest, payloads, state)
    finally:
        os.close(fd)


async def handle(request, vault_root, state_dir, *, client=None):
    """Async injectable API. client matches notebooklm-py notebooks/sources APIs."""
    try:
        require(isinstance(request, dict))
        require(Path(vault_root).is_absolute() and Path(state_dir).is_absolute())
        vault = Path(vault_root).absolute()
        state_path = Path(state_dir).absolute()
        require(vault.resolve() not in state_path.resolve().parents
                and state_path.resolve() not in vault.resolve().parents
                and state_path.resolve() != vault.resolve(),
                'unsafe_state', 'State must be outside the vault.')
        state = private_dir(state_path)
        for folder in ('manifests', 'receipts', 'payloads'):
            private_dir(state / folder)
        action = request.get('action')
        if action == 'preview':
            return preview(request, vault, state)
        require(action in ('upload', 'list-notebooks'), 'invalid_request', 'Unsupported action.')
        if action == 'upload':
            pinned_manifest(request, vault, state)  # consent/bytes checked before dependency/auth/network
        else:
            require(set(request) == {'action'})
        if client is not None:
            return await remote_action(request, vault, state, client)
        auth = private_dir(state / 'auth')
        private_dir(auth / 'profiles')
        private_dir(auth / 'profiles' / 'default')
        os.environ['NOTEBOOKLM_HOME'] = str(auth)
        for variable in ('NOTEBOOKLM_AUTH_JSON', 'NOTEBOOKLM_REFRESH_CMD', 'NOTEBOOKLM_PROFILE'):
            os.environ.pop(variable, None)
        # No fallback to ~/.notebooklm, browser cookies or global active context.
        # SDK logging is silenced: exception text may contain session material.
        import contextlib
        import io
        import logging
        previous_logging = logging.root.manager.disable
        try:
            logging.disable(logging.CRITICAL)
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                try:
                    from notebooklm import NotebookLMClient
                except ImportError:
                    raise Rejected('dependency_missing', 'Optional isolated notebooklm-py runtime required.') from None
                storage = auth / 'profiles/default/storage_state.json'
                require(storage.exists(), 'auth_required',
                        'Isolated NotebookLM login required; run login separately with NOTEBOOKLM_HOME set to state-dir/auth.')
                require(not storage.is_symlink() and storage.is_file()
                        and storage.stat().st_uid == os.getuid() and storage.stat().st_mode & 0o077 == 0,
                        'unsafe_state', 'Isolated auth must be a private regular file.')
                async with NotebookLMClient.from_storage(
                        path=str(storage), rate_limit_max_retries=0,
                        server_error_max_retries=0) as sdk:
                    return await remote_action(request, vault, state, sdk)
        except Rejected:
            raise
        except Exception as exc:
            return dict(ok=False, error=remote_error(exc))
        finally:
            logging.disable(previous_logging)
    except Rejected as exc:
        return dict(ok=False, error=dict(code=exc.code, message=exc.message))
    except PermissionError as exc:
        return dict(ok=False, error=remote_error(exc))
    except (OSError, ValueError, TypeError, UnicodeError):
        return dict(ok=False, error=dict(code='invalid_request', message='Invalid request or unavailable selected file.'))
    except Exception as exc:
        return dict(ok=False, error=remote_error(exc))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vault-root', required=True, type=Path)
    parser.add_argument('--state-dir', required=True, type=Path)
    args = parser.parse_args()
    try:
        raw = sys.stdin.buffer.read(65537)
        require(len(raw) <= 65536)
        result = asyncio.run(handle(strict_json(raw), args.vault_root, args.state_dir))
    except Exception:
        result = dict(ok=False, error=dict(code='invalid_request', message='Invalid JSON request.'))
    print(json.dumps(result, ensure_ascii=True))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
