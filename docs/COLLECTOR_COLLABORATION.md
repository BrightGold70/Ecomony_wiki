# Collaborating with an existing economics collection agent

[한국어 안내](#한국어-안내)

Use this contract when an existing AI agent or collector already adds papers and builds your Economics Wiki. Do not introduce a second competing collector. This is reusable guidance; no economics collector, hosted agent or schedule is configured by this document. Hawk_dottie's hematology assignment does not automatically extend to economics.

## Responsibilities

| Owner | Responsibilities |
|---|---|
| Primary collector / research agent | Authorized discovery, publication/version identity, lawful acquisition, original-file validation, collector-owned source/study records and intake checkpoints |
| Wiki integration agent | Proposed topic/entity updates, source-located synthesis, dataset/policy/method relationships and pending economist decisions |
| Dashboard / maintenance agent | Presentation, derived navigation/indexes, structural checks and hash-bound generated metadata—not rewriting collector evidence |
| Economist | Scope, access/transmission permission and scientific interpretation/review |

These may be roles of the same agent, but writes must still be serialized. Preserve collector locks, IDs and checkpoints. Do not steal locks, create duplicate schedules or use the folder intake to register already-collected publications again under a different filename/hash identity.

## Every new or revised record must expose its original

1. Literature links to its Source record.
2. The Source body contains a visible clickable **Open original document/PDF** link when an original is verified. A plain path or frontmatter field alone is not sufficient for a reader.
3. For a stored vault original, use its full vault-relative link, including extension. For existing externally stored originals, retain their location and use an explicitly registered file URI after existence/identity validation. Do not copy, move or rename originals without authorization.
4. If no local original is available, show the verified publisher/DOI or repository webpage and the actual access status. Never invent a local PDF or call an abstract a full-paper review.
5. Source-body links and dashboard buttons are separate acceptance checks. The dashboard's stored-PDF resolver supports safe declared vault raw paths; an external-file link in a Source note does not automatically become a dashboard PDF button.
6. Keep publication versions distinct. DOI/verified repository IDs establish publication identity; SHA256 establishes byte identity only. Same bytes do not prove the same economic study, and changed bytes do not automatically establish a new independent study.

## Economics-specific integration

Preserve question, estimand, identification assumptions, specification/inference, units/sample/period and exact source locator. Distinguish descriptive associations, causal claims, theory, counterfactuals and actual replication outputs. Dataset vintage, HS/SITC edition, reporter/partner, price/valuation basis and policy announcement versus implementation remain explicit when relevant. Shared samples are not independent evidence.

New calculations require real data/code/execution/output provenance. An LLM answer or cloud notebook is not an analysis ledger. Keep economist-review-needed until a named bounded human decision exists.

## After a successful collection batch

- Complete the primary collector's own sync/audit and repeat-run deduplication check.
- Propose integration into existing topics before creating duplicate entities; preserve old reviewed interpretations.
- Update navigation/log and record pending work.
- Refresh the dashboard and rebuild optional semantic search separately if its indexed content changed.
- Save local coverage/failure receipts; structural checks do not imply all papers were read or scientific claims approved.

No hosted-agent prompt, mailbox, queue, schedule or external-provider permission should change merely because the dashboard was updated. External transmission requires its own authorization and preview.

## Acceptance checklist and handoff

Ask the collector owner to run a small authorized batch and verify:

- Literature → Source → actual original or verified publication webpage works.
- Missing-PDF, inaccessible-source and hash-mismatch cases remain explicit.
- No original file moved; no duplicate publication or competing writer appeared.
- Repeated unchanged intake adds no duplicate records/revisions.
- Topic integration is completed or clearly pending, and relevant indexes reflect actual changes.
- Agent acknowledgment and the subsequent successful run are recorded separately.

Copyable message:

> Read docs/COLLECTOR_COLLABORATION.md and the working vault's current scope/schema/index/log. Coordinate with the existing primary collector instead of starting another. Ensure every new Source page visibly opens its registered original or verified publisher/repository page. Preserve originals, collector ownership and economist decisions. After serialized intake, verify deduplication and coordinate topic/navigation/search updates. Confirm which instructions you adopted and demonstrate the next batch; do not enable schedules or external uploads without permission.

## 한국어 안내

이미 경제학 논문을 모으는 AI 에이전트가 있다면 그 에이전트를 주 수집자로 유지하고, 대시보드 작업 때문에 별도 수집기·정기 작업을 중복 생성하지 않습니다. Hawk_dottie의 혈액학 담당 권한이 경제학까지 자동 확장되는 것은 아닙니다.

새 논문은 **Literature → Sources → 실제 원문 또는 확인된 출판사·저장소 페이지**로 이동할 수 있어야 합니다. 원본 경로가 평문이나 메타데이터에만 있는 것으로는 부족합니다. 원본 파일은 별도 허락 없이 이동·복사·이름 변경하지 않습니다. 원문이 없으면 접근 상태와 확인된 웹 링크를 표시합니다.

수집자는 식별자·버전·원본·체크포인트를 관리하고, 통합 에이전트는 기존 주제 수정안을 제시하며, 유지관리 에이전트는 구조·검색을 점검합니다. 경제학자는 식별 가정과 해석을 판단합니다. 데이터 판·품목분류·통계 명세·정책 시행일을 보존하고 LLM 문장을 새 계산 결과의 근거로 사용하지 않습니다.

주 수집자의 동기화·반복 실행 점검 뒤 목차·활동 기록·주제 통합과 검색 갱신을 조정하세요. 이 문서를 저장했다고 다른 에이전트가 읽었다는 뜻은 아닙니다. 담당 에이전트의 확인과 다음 실제 처리 결과를 따로 검증해야 합니다.
