# 경제학 질문·아이디어 연결과 안전한 점검

[English / 상세 기술 계약](ZETTEL_WORKFLOW.md) · [일상 사용](ECONOMIST_GUIDE_KO.md) · [유지관리](MAINTENANCE.md)

## 일상 사용 순서

1. 질문 하나와 허가된 소수 자료를 고릅니다. 기존 규칙·목차·최근 활동 기록을 먼저 확인합니다. 일괄 변환부터 시작하지 않습니다.
2. 실제 원문·버전을 확인하고 핵심 요약 다섯 항목을 작성합니다. 아래 영문 제목은 대시보드 파서와 공유하므로 그대로 유지합니다.
3. 논문 전체 요약과 구별되는 명제 하나짜리 Idea를 만듭니다. 명제, 설명, 정확한 근거, 적용 범위·불확실성, 연결, 열린 질문을 담습니다.
4. Question 지도에서 현재 해석, 지지 근거, 상충 근거, 적용 범위, 미해결 질문, 검토 상태를 연결합니다. 정당한 연결만 만들며 개수 할당량은 없습니다.
5. 준비된 대시보드의 **Questions and ideas**를 열어 질문 → 아이디어 → 인용 근거 → 원래 노트 순으로 읽습니다. 유형은 Questions and ideas / Questions / Ideas, 근거 표시는 All evidence coverage / Evidence declared — not yet checked / Evidence missing이며 텍스트 검색과 Clear workspace filters도 있습니다. 근거 표시는 선언된 연결이지 검증 결과가 아닙니다. 기본 검색 필터는 country, product, method, evidence_kind, subject, keyword 그대로입니다. 아홉 폴더 범주와 기록된 출판 역할은 맥락이며 별도 출판 역할 선택기가 있다고 가정하지 않습니다. 저장된 요약과 초록은 각각 펼쳐 읽습니다. 새 플러그인을 배포하지 않은 설치에서는 해당 화면이 아직 없을 수 있습니다.

핵심 요약은 `## Essential study summary` 아래 다음 `###` 제목을 정확히 씁니다.

- **Essential finding**: 근거가 있는 본인 표현의 핵심 발견. 저자 해석·본인 해석과 구별합니다.
- **Population and comparison**: 국가·설정, 표본·기간, 노출·비교, 자료 빈티지·단위. 이론은 가정·모형 비교로 설명하며 실증 표본을 만들지 않습니다.
- **Key result**: 추정 대상, 명세, 추정치·단위·불확실성 또는 이론 명제. 재현 주장은 실제 코드·자료·환경·실행·산출물 기록이 있어야 합니다.
- **Main limitation**: 식별 가정·위협, 측정·모형 한계, 읽지 않은 부분, 미확인 항목. 인과 식별을 만들어내지 않습니다.
- **Relevance to question**: 연결한 질문에 대한 관련성과 범위. 정책 권고 승인이 아닙니다.

다섯 항목이 없어도 초록 앞부분으로 대신하지 않습니다. `summary_status: insufficient-evidence`는 다섯 항목을 채워도 근거 부족입니다. 부족한 자료·평가 작업을 구체적으로 남깁니다.

Literature, Topics, Datasets, Policies, Methods, Theories, Analyses, Comparisons, Queries 아홉 범주를 그대로 유지합니다. Sources는 출처이며 요약 보조 노트는 Review/readability-pilot에 별도로 저장합니다. Ideas/Questions는 연구 편수에 포함하지 않습니다. 기존 출처·자료·주제 노트를 덮어쓰지 않습니다.

## 연결과 독립성

기본 연결: `supports`, `challenges`, `qualifies`, `mechanism`, `measurement`, `same-cohort`, `unresolved`. 추가 호환 연결: `developed-by`, `contextualized-by`, `qualified-by`, `continues`, `supported-by`. 대상·이유·`suggested`/`recorded` 상태를 기록합니다. recorded는 기록된 주장이지 전문가 승인이 아닙니다.

입력 별칭은 명시적으로 정규화합니다: conflicts-with→challenges; extends/supersedes→continues; applies-to→contextualized-by; same-cohort-as/same-dataset→same-cohort; independent-support-for/replication→supports; addresses→unresolved. 자료 중복·재현의 구체적 의미는 설명에 남깁니다. 별칭만으로 독립성이나 실제 재현을 입증하지 않습니다. `cohort_id`에는 기록된 표본·자료의 안정적 식별자를 쓰고 independence를 same-cohort/independent/unknown과 근거로 명시합니다. 같은 자료의 다른 명세나 워킹페이퍼·출판본을 독립 연구로 세지 않습니다.

도우미에게 복사할 요청:

> 이 질문과 선택한 자료만 확인해 주세요. 기존 규칙·목차·최근 기록과 원문 버전·정확한 문장을 확인한 뒤 다섯 핵심 요약, 명제별 아이디어, 질문 지도를 제안하세요. 추정 대상·식별 가정·자료 빈티지·중복·단위·불확실성을 구분하고 모르는 것은 그대로 남기세요. 기존 파일을 보존하고 생성 전용 미리보기를 보여준 뒤 허락을 기다리세요. 외부 전송·설치·일괄 도구·일정 변경은 하지 마세요. 주제 통합 대기와 경제학 전문가 검토 대기를 별도로 보고하세요.

## 기술 담당자: 미리보기와 적용

Node.js 22+가 필요합니다. 추가 의존성·모델·네트워크가 필요하지 않습니다.

```sh
node scripts/zettel-producer.cjs --vault /absolute/authorized-fixture --proposal /private/proposal.json --out /private/new-preview.json
node scripts/zettel-audit.cjs --vault /absolute/read-only-snapshot --out /private/new-audit.json
```

producer는 기본 미리보기이며 보관함을 수정하지 않습니다. JSON 계약 전체는 [영문 기술 안내](ZETTEL_WORKFLOW.md#technical-helper-explicit-proposal-contract)를 따릅니다. schema_version은 1, notes와 references를 명시합니다. 기존 링크는 현재 전체 파일 SHA256으로 고정합니다. 근거는 source/source_sha256/source_version, locator의 start_line/end_line/label, 실제 quote, evidence_scope, cohort_id, relationship, independence/independence_basis를 갖습니다. 줄 번호는 프런트매터를 포함한 전체 파일의 1부터 시작하며 끝 줄도 포함합니다. 정확한 인용이 그 범위 안에 있어야 합니다. 버전은 로컬 version/version_key 또는 검증된 version_locator로 확인합니다. 제공한 버전 위치는 프런트매터가 일치해도 검사합니다.

숨김·raw·private·상위 경로·심볼릭 링크·별칭·절 링크·Markdown 이외 근거는 거부합니다. 출력 보고서는 보관함 밖의 새 파일만 허용합니다. 초안은 `economist-review-needed` 상태만 생성합니다. 요약은 아홉 편집 범주 또는 Sources의 현재 전체 해시를 target_sha256으로 고정하며 Review/readability-pilot에만 새로 만듭니다. 기존 대상·Sources를 수정하지 않습니다.

`--apply`는 명시적으로 요청한 격리된 파일시스템 작업공간에서만 씁니다. 전체 목적지를 먼저 검사하고 현재 근거를 재검증한 뒤 새 파일만 생성·재읽기합니다. 목차·활동 기록은 자동 갱신하지 않습니다. 여러 파일 적용은 트랜잭션이 아니므로 오류·경합 시 일부만 생성될 수 있습니다. 영수증과 실제 경로를 확인하고 덮어쓰기 재시도하지 마세요. 초기화도 추가 전용이며 기존 규칙·사용자 템플릿을 갱신하지 않습니다.

### Native-only Obsidian 보관함

파일시스템 `--apply`를 사용하지 마세요. 공식 Obsidian API로 허가된 한정 스냅샷을 얻어 검증합니다. 적용 직전 `app.vault.read`로 현재 대상·참조·근거의 해시, 정확한 줄·인용·버전을 다시 확인합니다. `getAbstractFileByPath`로 새 대상의 부재를 확인하고 `app.vault.createFolder`/`app.vault.create`로만 생성합니다. 이 초안에 modify를 사용하지 않습니다. 생성한 모든 노트를 독립적으로 재읽어 의도한 전체 바이트와 대조하고 근거도 재확인합니다. 경합·변경·부분 실패 시 멈춥니다. 이는 담당자 절차이지 설치된 native 자동 적용 서비스가 아닙니다.

## 유지관리와 결과 해석

허가된 읽기 전용 스냅샷에 audit를 실행하고 전후 모든 파일 해시로 보존을 확인합니다. Ideas, Questions, Review/readability-pilot을 검사하며 허용된 연구 Markdown만 읽습니다. 누락·깨진 링크·오래된 근거·요약 대상 변경·중복/경쟁 요약을 보고하지만 수리·승인·재고정하지 않습니다. 요약 판정은 대시보드 essentialSummary와 같은 함수를 사용합니다.

설명형 위치 정보만 있는 native 기록은 전체 파일 해시·인용 일치까지만 검사합니다. 줄 범위·버전이 불명확하면 별도 미검증으로 남기며 임의로 정밀도를 만들지 않습니다. 근거 수, 해시·인용 일치, 완전 검증, 미검증 범위·버전, 대상 검사, 준비된 요약 수는 각각 다른 분모입니다. 0개 해시 검사는 근거 검증 범위가 없다는 뜻입니다. 일치해도 외부 최신성·해석 타당성·인과 식별·독립성·전문가 승인을 보장하지 않습니다.

```sh
node --test scripts/test-zettel-producer.cjs scripts/test-zettel-audit.cjs scripts/test-init.cjs
```

위 검사는 격리된 합성 자료에서 실제 CLI와 대시보드 파서의 왕복을 시험합니다. native 배포·전체 자료 검토·정기 실행·사람의 수용성 검증과는 다릅니다. 구조 lint, registry, 의미 검색 색인 갱신, 실질적 Topic 통합도 별도 작업입니다. 새 서비스·일정·외부 전송은 설치하거나 실행하지 않습니다.
