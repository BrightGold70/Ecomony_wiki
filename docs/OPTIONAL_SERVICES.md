# Optional services — separate from the local wiki

[Setup](FROM_SCRATCH.md) · [한국어 요약](#한국어)

The core local dashboard uses Node.js 22+ and Obsidian with no AI key or npm package dependencies. A tool-using AI helper you separately authorize can prepare notes without configuring the optional provider tool. Full tests/Python-backed tools additionally need working Python 3.10+.

Run `node scripts/doctor.cjs` from the checkout before configuration. It is read-only: core readiness does not imply optional readiness; semantic/synthesis `ready: false` means not configured/verified, not necessarily failed. Do not inherit author paths, guessed models or another project's environment variables. Inspect current CLI/configuration before an authorized setup, and verify an actual small run separately from an executable probe.

## PDF extraction

Poppler's `pdftotext` is optional for text-layer PDF intake, not required for TXT/Markdown or basic search. Install only after permission. Scanned/image-only PDFs need separate authorized OCR. Extraction does not verify bibliography, equations, table alignment or full-paper understanding. Preserve original-byte hashes separately from extracted-text hashes.

## Local semantic search

QMD needs its own executable, model assets and a scoped collection/index. The shipped filesystem adapter takes the `economy_wiki` subtree itself as `--vault` (unlike initializer/intake/lint, which take its parent). It requires an explicit `--tool-root` or `ECONOMY_QMD_ROOT`, with `@tobilu/qmd` exactly `2.8.3` installed in that isolated root; the code pins its embedding configuration. The adapter stages allowed compiled research notes into a private mirror; do not index an entire personal vault, raw papers or confidential-data folders. Runtime state/models remain outside the evidence tree and source repository. Model download, disk/time cost and indexing are separate authorized actions. Source changes require a separate index rebuild; stale hits must not be treated as current evidence. Use ordinary keyword search while this is not configured.

Example commands after separately authorized installation/configuration (these commands build/query an index and are not read-only probes):

```sh
node scripts/qmd-adapter.cjs build --vault /absolute/vault/economy_wiki --tool-root /absolute/private-qmd-runtime
node scripts/qmd-adapter.cjs query --vault /absolute/vault/economy_wiki --tool-root /absolute/private-qmd-runtime --lex "employment" --vec "employment" --mode fast
```

`--mode fast` uses typed hybrid retrieval without reranking; `rerank` and `expanded` request additional model work. Claim reranking only when the actual receipt validates it. `ECONOMY_QMD_ROOT` selects the same root when `--tool-root` is omitted; no author directory is a default. This adapter reads an allowlisted filesystem mirror; it is **not** a native Obsidian snapshot pipeline.

## Official Obsidian CLI bridge (optional)

The shipped `scripts/obsidian-cli.cjs` wrapper forwards to the official Obsidian CLI and can await asynchronous `eval` results and flush large output. It does not enable CLI/eval permissions, choose an authorized vault or install the app. Discover the executable and exact vault binding with the user; inspect the installed official CLI help rather than guess commands. On macOS its platform default is the standard application executable; override with `OBSIDIAN_CLI_BINARY` when needed. Do not enable eval merely to fix core search.

```sh
node scripts/obsidian-cli.cjs help
```

A successful bridge probe is not native snapshot verification. Do not claim the economics QMD adapter uses native snapshots, or that the bridge grants dashboard provider capabilities.

## Dashboard provider synthesis

The implemented Python bridge uses authenticated Hermes and an explicit approved provider/model, with Python 3.10+. The provider receives the selected question, note paths/titles and passages; costs and normal provider/Hermes session retention may apply. Preview the actual content and obtain deliberate permission. A local mirror is not permission for cloud transmission. Treat restricted metadata as confidential too.

The current dashboard is local evidence mode and does not itself invoke providers; the optional bridge is a separately authorized technical-helper command. Its current CLI requires `--vault-root` (the parent vault), `--provider` and `--model`, accepts `--mode extractive|draft-synthesis`, and reads selected evidence JSON on stdin. Run its `--help` using the working Python reported by the doctor. `PYTHON` selects the full-test runtime; it is not a provider credential. Configure only the actual supported runtime settings after inspecting the installed tool/current UI. A command described in documentation is not an installed service or authenticated account. No provider/model defaults should silently substitute for the user's chosen boundary. Verify actual execution receipts and citations; unavailable/stale receipt verification must not be described as a successful verified synthesis. Provider output remains `economist-review-needed` and cannot establish causal identification or independent reproduction.

## Monitoring and other integrations

Publication monitoring checks named sources only and does not guarantee notice/retraction coverage or dataset/policy revision awareness. No background collector, watcher, scheduler, phone alert, economic API connector, EconoSuite exchange or cloud notebook upload is enabled by initialization. Each requires separate scope, permission and observed verification. Backups and restore tests are separate from search/monitoring.

## 한국어

기본 로컬 검색에는 Node.js 22+·Obsidian이 필요하며 AI 키·npm 패키지 의존성은 없습니다. 전체 테스트·Python 도구는 실제 작동하는 Python 3.10+가 추가로 필요합니다. 별도로 쓰는 AI 담당자가 선택형 제공자 도구로 자동 설정되지 않습니다.

`node scripts/doctor.cjs`는 읽기 전용입니다. 기본 준비와 선택 기능 준비는 다릅니다. 의미 검색·AI 종합의 `ready: false`는 미설정·미검증이며 고장을 확정하는 값은 아닙니다. 개인 경로·다른 프로젝트 설정을 복사하거나 허락 없이 설치·인증하지 마세요.

텍스트 PDF 처리에는 선택적으로 Poppler `pdftotext`를 사용합니다. 스캔은 별도 OCR이 필요하며 추출은 표·수식·전체 평가의 검증이 아닙니다. QMD는 별도 실행 파일·모델·허용된 연구 노트만의 색인이 필요합니다. 원자료·개인 보관함 전체를 색인하지 말고 미설정이면 기본 검색을 쓰세요.

현재 화면은 로컬 근거 모드이며 제공자를 직접 호출하지 않습니다. 선택형 Python 종합 도구는 담당자가 별도 실행하며 Python 3.10+, 인증된 Hermes, 명시한 제공자·모델과 전송 미리보기·허가가 필요합니다. 질문·노트 경로·제목·발췌문이 전송되며 비용·보관이 발생할 수 있습니다. 제한된 메타데이터도 보호하세요. 실제 실행·영수증 검증 없이 성공을 주장하지 말고 결과는 `economist-review-needed`로 둡니다. 자동 수집·예약·외부 데이터 연결·백업은 별도 작업입니다.

QMD의 `--vault`는 부모가 아닌 `economy_wiki` 폴더이고 `--tool-root` 또는 `ECONOMY_QMD_ROOT`에 격리된 정확한 `@tobilu/qmd` `2.8.3` 설치가 필요합니다. 현재 어댑터는 허용된 파일시스템 사본을 읽으며 Obsidian 네이티브 스냅샷 기능이 아닙니다. 선택형 `scripts/obsidian-cli.cjs`는 공식 CLI의 비동기 eval 대기를 돕지만 권한·앱·제공자를 설정하지 않습니다. 실행 파일은 필요하면 `OBSIDIAN_CLI_BINARY`로 지정합니다. 실제 보관함 연결과 CLI/eval 권한은 별도 확인하며 기본 검색 때문에 임의로 켜지 않습니다. Python 도구는 부모 보관함의 `--vault-root`, 명시적 `--provider`·`--model`과 표준입력 근거 JSON을 사용합니다. 전체 테스트용 인터프리터는 `PYTHON`으로 고를 수 있습니다.
