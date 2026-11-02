# Publication keywords, optional MeSH and read-only refresh

## Economics first

Publication keywords are literal recorded metadata, not guessed words from titles or abstracts. Keep publisher keywords, PubMed KeywordList attribution, MeSH controlled indexing, JEL classifications, user tags and economic applicability distinct. MeSH is optional compatibility for explicitly imported indexed material (for example, health economics); ordinary trade papers do not require MeSH. This port does not fetch PubMed or manufacture JEL/MeSH assignments.

## Daily use

Open **Publication keywords**. Search the recorded vocabulary, select a term, then read associated document cards and open their source/original. Choose vocabulary kind **Publication keywords**, **MeSH** or **Both** deliberately. Inspect provenance for source URL, locator, record hash, identity/version, descriptor UI and any qualifiers/Major Topic flags. Hash agreement establishes local consistency, not authentic indexing, economic validity or review approval.

Paper–keyword and Paper–MeSH graphs describe metadata relationships, not causal evidence, agreement or independent replication. Ordinary paper relationships exclude bibliographic navigation nodes; All indexed makes them explicitly inspectable. Navigation-only pages are not topic syntheses and should not inflate substantive entity counts. Shared paths do not imply shared vocabulary type.

Missing metadata means pending/not recorded, not proof of no indexing or no relevance. Source-version coverage and compiled-note coverage differ. A Source and matching Literature record are not two independent studies. Deduplication uses explicit supported identity rules; do not silently merge by similar titles or call note counts study counts.

## Collector contracts

The dashboard supports the provenance formats exercised by its parser tests, including explicit keyword appendices and optional `explicit-mesh-v1` / collector `typed-publication-indexing-v2` MeSH records. Bind the latest relevant appendix to its recorded identity/version, retain descriptor and individual qualifier Major Topic flags, and reject malformed latest data rather than reviving stale records. A bibliographic node may retain a `keyword-*` path while validated MeSH observations define its MeSH edges.

Unknown collector formats require an adapter and fixture tests; do not rewrite a working collection just to satisfy a dashboard prototype. The software port does not install a daily collector, import the Hematology collection or establish live Economics indexing coverage.

## From-scratch offline attachment

The dashboard readers previously supported collector appendices but initialization/intake did not produce them. The kit now supplies an explicit offline writer; this is **not** a collector or source-authentication service.

1. Initialize a new parent vault; create the first linked Source/Literature pair by templates or [folder intake](FOLDER_INTAKE.md). Both drafts start keyword inspection pending / optional MeSH pending. Existing vault initialization never overwrites templates or schema.
2. Inspect an authorized publisher/JATS/PDF explicit keyword field or identity-matched cached PubMed record. Keep its exact bytes immutably under `economy_wiki/raw/`, distinct from original-paper bytes where appropriate. Compute actual SHA256. No automatic network call or private collection is required.
3. Copy the JSON shape from [`templates/Indexing-metadata.md`](../templates/Indexing-metadata.md) (also installed at `economy_wiki/Templates/Indexing-metadata.md`) into a deliberately selected packet file outside the checkout. Supply exact existing pair paths, inspected identity/version/date, evidence path/hash, literal typed keywords and optional MeSH. Empty arrays remain pending, never an absence claim. MeSH and PubMed KeywordList attachment currently require a declared `pmid:` identity; DOI-only publisher keyword packets are supported without MeSH. RePEc-only/unidentified records stay pending until a supported verified identity/adapter exists.
4. Preview, inspect exact changed paths, then authorize apply:

```sh
node scripts/attach-indexing.cjs --vault /absolute/parent-vault --metadata /absolute/inspected.json
node scripts/attach-indexing.cjs --vault /absolute/parent-vault --metadata /absolute/inspected.json --apply
node scripts/lint-wiki.cjs /absolute/parent-vault
```

The helper validates the explicit Source/Literature relationship, scoped regular non-symlink paths, local original/evidence hashes, public provenance URL grammar, record identity/version, descriptor/qualifier UI and separate boolean Major Topic flags. It hashes appendices, preserves existing prose/frontmatter and original bytes, attaches matching provenance to both records, creates deterministic navigation-only Topics, and adds index/log entries. Initial frontmatter pending defaults are historical defaults; latest hash-checked appendices determine dashboard state. JEL and economics evidence/domain fields are not rewritten. Navigation nodes are not substantive Topics or independent studies. Sources are provenance, not duplicate paper graph nodes.

Exact repeat is a byte-preserving no-op. Existing reviewed notes, collector indexing sections, edited receipts and conflicting/curated nodes fail closed **before writes**; use a separately authorized preserved-version migration, not a force flag. Compatible helper-created nodes can be reused across papers without changing their original bytes. New versions/changed packets require manual migration. Keep one authorized writer: this is not an adversarial concurrent-filesystem sandbox or a power-loss transaction across all files.

5. Refresh the dashboard; verify literal keywords and their kinds, MeSH descriptor/qualifier flags and provenance, open the actual evidence/source/original, then inspect Paper–keyword / Paper–MeSH graphs. Default papers graph must exclude navigation-only nodes. Missing fields are pending. Hash agreement is local consistency, not publisher/PubMed authentication, economic validity or scientist approval. The helper does not fetch evidence, inspect semantic truth of the packet, run QMD or call providers. Unsupported keyword source hosts require a separately tested allowlist/adapter; never substitute a fabricated allowed URL.

Reproduce mechanics without any real collection: `node --test --test-concurrency=1 scripts/test-attach-indexing.cjs` exercises fresh init → first intake → metadata attachment → actual dashboard parsers/graphs → repeated byte preservation → lint, plus honest pending states and safety refusals. Synthetic identities/terms demonstrate grammar only, not authentic indexing. Build separately with `npm run build`. Desktop Obsidian acceptance and real-source accuracy are not certified by fixtures.

## Automatic display refresh

Authorized research-note create/modify/delete/rename events trigger debounced local refresh. Keep Economics' nine compiled categories and its country/product/method/evidence controls. Preserve active preferences and surviving selections. Sources provide metadata provenance without becoming duplicate paper graph nodes.

Display refresh does not rebuild QMD or send material to a provider. A semantic-staleness hint asks for a separate deliberate index rebuild. No collector-owned note, raw file, personal account, scheduled job or notebook is changed by refreshing.

## 한국어

처음부터 만들 때도 색인 단계를 빠뜨리지 마세요. 초기화·폴더 처리는 키워드 확인 대기/선택 MeSH 대기로 시작하며, `Templates/Indexing-metadata.md`의 형식으로 실제 확인한 메타데이터와 원본 해시를 기록합니다. `node scripts/attach-indexing.cjs --vault /절대/부모보관함 --metadata /절대/확인자료.json`으로 미리 보고 허가 후 `--apply`를 추가합니다. Source/Literature 양쪽에 해시 결합 부록과 탐색 노드가 생깁니다. 동일 입력 재실행은 바이트를 바꾸지 않고 검토 완료·수집기 부록·충돌 노드는 덮어쓰지 않습니다. 키워드/MeSH/JEL을 추정하거나 자동으로 네트워크에서 가져오지 않습니다. 빈 배열은 ‘없음’이 아니라 대기입니다.

**Publication keywords**에서 실제 기록된 키워드를 검색하고 관련 논문 카드와 원문을 엽니다. 키워드·JEL 분류·MeSH·사용자 태그를 구분합니다. MeSH는 건강경제학 등 실제 색인 자료를 가져오는 경우의 선택 기능이며 일반 무역 논문의 필수 요건이 아닙니다. JEL이나 MeSH를 추정하여 부여하지 않습니다.

출처·근거 해시·식별자·버전과 MeSH 하위표목/주요 주제 여부를 유지합니다. 키워드·MeSH 관계는 탐색 연결이지 인과관계나 경제학적 검증이 아닙니다. 미기록 상태는 관련성이 없다는 뜻이 아닙니다.

자료 변경 시 화면만 자동 갱신합니다. 의미 검색 색인 재구축과 외부 전송은 별도입니다. 혈액학 자료·개인 계정·자동 수집 운영 설정은 복사하지 않습니다. 코드 테스트와 실제 경제학 수집 데이터 검증은 별개입니다.
