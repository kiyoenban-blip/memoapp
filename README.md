# QuickNote

빠르게 기록하고 다시 이어 쓰는 로컬 우선 메모 앱. React · TypeScript · Vite · Dexie · Supabase.

## 실행

Node.js 22.12 이상(현재 검증 환경: 24)을 사용합니다.

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
npm test
npx playwright install chromium
npm run test:e2e
```

개발 서버는 5173, 프로덕션 미리보기는 4173 포트를 사용합니다.

## 기능

- IndexedDB 자동 저장, 본문 검색, 첫 줄에서 제목 추출
- 마크다운 편집과 안전한 미리보기, 체크박스 클릭 반영
- 메모 고정, 휴지통과 복원, 할 일 진행도
- 모바일 단일 화면 / 데스크톱 목록·편집기, 시스템 다크 모드
- 설치형 PWA, 프로덕션 서비스 워커로 앱 셸 오프라인 캐시
- 이메일 매직링크 로그인, 온라인 복귀·15초 주기·Realtime 알림 시 동기화

단축키: Ctrl/⌘+Shift+N 새 메모, Ctrl/⌘+K 검색, Ctrl/⌘+Shift+P 미리보기, Ctrl/⌘+S 동기화.

## Supabase 연결

1. Supabase 프로젝트를 만들고 SQL Editor에서 `supabase/schema.sql`을 실행합니다.
2. `.env.example`을 `.env.local`로 복사하고 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`에 프로젝트 URL과 공개 anon key를 넣습니다. **service_role 키는 절대 브라우저에 넣지 않습니다.**
3. Authentication → URL Configuration에 사이트 주소와 로그인 리디렉션 주소를 등록합니다. 개발 주소도 필요한 경우 등록합니다.
4. 서버를 다시 시작합니다. 계정 설정에서 이메일 로그인 링크를 요청합니다.
5. 동일 계정으로 두 브라우저에서 작성·수정·삭제·복원·오프라인 편집 후 재연결을 검증합니다.

설정이 없으면 로컬 전용 모드입니다. 로컬 메모와 사용자별 메모는 별도 보관하며 로그인 시 자동 이관하지 않습니다. 로그인 후 계정 설정의 복사 버튼으로 원본을 유지하면서 계정에 한 번 복사할 수 있습니다. 다른 계정으로 전환하면 해당 계정의 메모만 보입니다. 로그아웃해도 이 브라우저의 저장 데이터는 유지됩니다. 공용 기기에서는 브라우저 데이터를 삭제하세요.

동기화는 UUID와 수정 시간 기반 last-write-wins입니다. 서버 RPC가 더 오래된 쓰기를 거부합니다. 동기화 중 발생한 로컬 수정은 다음 동기화까지 유지합니다. 삭제는 tombstone으로 전파하며 복원할 수 있습니다. 동시 편집이나 기기 시계 오차로 내용이 유실될 수 있습니다. 공동 편집 용도로 사용하지 마세요.

## 배포 및 오프라인

`npm run build`로 만든 `dist`를 HTTPS 정적 호스팅에 배포합니다. 빌드 환경에 위 두 VITE 변수를 설정하고 Supabase 리디렉션 주소도 배포 주소로 변경하세요. 앱은 도메인 루트 배포를 기준으로 구성되어 있습니다.

PWA는 HTTPS 또는 localhost에서 동작합니다. 한 번 온라인으로 앱을 열어 서비스 워커 설치를 완료한 후 브라우저의 설치/홈 화면 추가 기능을 사용하세요. 서비스 워커는 앱 파일만 캐시하며 인증·Supabase API 응답은 캐시하지 않습니다. 최초 접속 전에는 오프라인 실행이 불가능합니다. 실제 휴대폰 설치와 기기 간 동기화는 Supabase 및 HTTPS 배포 후 별도 확인이 필요합니다.

브라우저 저장 공간 삭제·시크릿 모드 종료·기기 분실 시 동기화하지 않은 메모가 유실될 수 있습니다. 폴더·태그·첨부·공유·내보내기/가져오기는 포함하지 않습니다.

클라우드에 설치된 Chromium을 사용할 때: `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`. 별도 Playwright 브라우저 다운로드는 필요하지 않습니다.

## 바탕화면 메모지

메모를 선택한 뒤 편집기 상단의 **메모지로 띄우기** 버튼을 누르면 360×380 크기의 작은 포스트잇 창이 열립니다. 창 테두리로 크기를 바꾸고 제목 표시줄로 원하는 위치에 옮기세요. 노랑·분홍·초록 색상을 고를 수 있으며, 입력 내용은 기존 메모와 같은 IndexedDB에 자동 저장됩니다. 원래 앱 창을 닫아도 메모 창은 사용할 수 있습니다. 여러 메모를 각각 띄울 수도 있습니다.

팝업이 차단되면 이 사이트의 팝업을 허용하세요. 브라우저에 따라 새 탭으로 열릴 수도 있습니다. 이것은 웹 앱의 별도 창이며 Windows 바탕화면 위젯이나 항상 위 고정 기능은 아닙니다. 항상 위에 두려면 Windows PowerToys의 Always On Top을 켜고 해당 창에서 Win+Ctrl+T를 누르세요. Windows 로그인 시 자동 실행은 아래 Windows 패키지로 설정할 수 있습니다. 브라우저 설치 메뉴로 QuickNote를 설치하면 앱처럼 실행할 수 있습니다.


## Windows 로그인 시 자동 실행

`npm run package:windows`로 `release/QuickNote-Windows` 패키지를 만듭니다. 해당 폴더를 Windows PC로 옮겨 **Install.cmd**를 실행하면 다음을 수행합니다.

- `%LOCALAPPDATA%\QuickNote`에 빌드된 앱과 작은 로컬 호스트 설치
- Windows 기본 PowerShell/.NET으로 호스트 실행 파일을 한 번 컴파일
- 현재 사용자의 시작프로그램 폴더와 바탕화면에 바로가기 등록
- Edge 앱 창으로 마지막 메모 열기 (최초 실행이면 빈 메모 생성)

이후 Windows **로그인 시** 자동 실행됩니다. 관리자 권한, Node.js, npm, 인터넷 접속은 실행에 필요하지 않습니다. Windows 10/11 및 Edge가 필요합니다. `Disable-Autostart.cmd`로 자동 실행만 해제할 수 있으며 메모는 유지됩니다. 재설치로 다시 켤 수 있습니다.

메모는 기본 Edge 프로필의 `http://localhost:43827` IndexedDB에 저장됩니다. 기존 개발 서버나 배포 사이트와는 별도 저장소이며 자동 이전되지 않습니다. Supabase를 설정하지 않은 기본 패키지는 로컬 전용입니다. 작은 로컬 호스트는 창을 닫아도 로그아웃할 때까지 남고 루프백에서만 연결을 받습니다. 이 포트를 이미 사용하는 프로그램이 있으면 먼저 충돌을 해결해야 합니다. Windows 실제 설치와 재로그인은 대상 PC에서 확인해야 합니다.


PC·모바일 최초 연결의 자세한 순서는 [동기화 연결 안내](supabase/CONNECT.md)를 따르세요. Supabase와 HTTPS 사이트가 아직 준비되지 않았다면 실제 기기 간 연동은 활성화되지 않습니다.

## Cloudflare Workers 자동 배포

GitHub 저장소의 `main` 브랜치를 연결합니다. 루트 디렉터리는 저장소 루트이며 빌드 명령은 `npm run build`, 배포 명령은 `npx wrangler deploy`입니다. `wrangler.jsonc`가 `dist`를 정적 자산으로 배포합니다.

`VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`는 **Build 설정의 빌드 환경 변수**에 추가해야 합니다. Workers 런타임 변수만 설정하면 Vite 번들에 반영되지 않습니다. 변경 후 새 빌드를 실행하고, Supabase 로그인 허용 주소에도 최종 배포 주소를 등록하세요.
