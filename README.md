# 경쟁사 분석 자동화 템플릿

> 제품 아이디어 + 경쟁사 2~3개 입력 → 에이전트가 경쟁사 추가 발굴 + 전략 보고서 자동 생성

## 사전 준비

- [Claude Code](https://claude.ai/code) 설치 필요

## 사용 방법

### 1. 이 템플릿 복사
```bash
# GitHub에서 "Use this template" 클릭 후 클론
git clone https://github.com/[your-username]/competitive-analysis-template.git
cd competitive-analysis-template
```

### 2. 입력 파일 작성
`data/input.md`를 열고 아래 내용을 채워주세요:
- 내 제품/아이디어 설명
- 타겟 고객
- 핵심 가치 제안
- 알고 있는 경쟁사 2~3개 (모르면 비워도 됩니다)

### 3. Claude Code 실행
```bash
claude
```

### 4. 스킬 실행
```
/competitive-analysis
```

### 5. 결과 확인
`output/competitive-analysis-report.md` 파일을 확인하세요.

---

## 에이전트가 자동으로 하는 것

1. **경쟁사 추가 발굴** — 입력한 경쟁사 외에 직접/간접/잠재 경쟁사 3~5개 추가 발굴
2. **심층 분석** — 각 경쟁사의 기능, 가격, 타겟, 포지셔닝, 강약점 조사
3. **비교 매트릭스** — 한눈에 비교할 수 있는 표 생성
4. **화이트스페이스 분석** — 아무도 안 하는 기회 영역 발굴
5. **전략 제언** — 차별화 포인트 + 단기/중기 포지셔닝 로드맵

---

## 폴더 구조

```
competitive-analysis-template/
├── README.md                          # 사용 방법
├── CLAUDE.md                          # 에이전트 분석 원칙
├── .claude/
│   └── skills/
│       └── competitive-analysis.md   # /competitive-analysis 스킬 정의
├── data/
│   └── input.md                      # 사용자가 입력하는 파일
└── output/
    └── competitive-analysis-report.md  # 자동 생성되는 결과물
```

---

## 라이선스
MIT License — 자유롭게 사용, 수정, 배포 가능
