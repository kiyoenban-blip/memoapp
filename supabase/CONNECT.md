# PC · 모바일 연결 순서

## 1. Supabase 프로젝트 준비

https://supabase.com 에서 계정과 프로젝트를 생성합니다. SQL Editor에서 이 폴더의 `schema.sql` 전체를 실행합니다. 테이블, 사용자별 접근 권한(RLS), 충돌 처리 RPC와 Realtime이 준비됩니다.

프로젝트 설정의 API/Connect 화면에서 Project URL과 **공개 anon 키 또는 publishable 키**를 찾습니다. `service_role`, secret 키, 데이터베이스 비밀번호는 앱에 넣지 마세요.

프로젝트 루트의 `.env.local` 또는 클라우드 환경 설정에 다음 두 값을 넣습니다. 환경 설정에서 입력한 값은 다음 빌드에 실제로 주입되어야 합니다.

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-KEY
```

코드는 빌드 시 이 값을 읽습니다. 웹 배포와 Windows 패키지를 **같은 값으로 다시 빌드**해야 합니다. 값 변경 후 실행 중인 개발 서버도 재시작합니다.

## 2. 모바일에서 접속할 HTTPS 사이트 준비

`npm run build`로 만들어진 `dist` 폴더를 Netlify, Cloudflare Pages 등 HTTPS 정적 호스팅에 배포합니다. 폴더 업로드를 지원하는 호스팅에는 `dist`의 내용만 올립니다. 소스 코드나 `.env.local`은 올리지 않습니다. 도메인 루트 배포를 사용하세요.

Supabase Authentication → URL Configuration에서:

- Site URL: 배포한 HTTPS 주소
- Redirect URLs: 배포한 HTTPS 주소와 `http://localhost:43827` (Windows 메모 창)
- 개발용 로그인이 필요하면 개발 서버 주소도 별도 추가

모바일에서는 Windows의 localhost 주소를 열지 말고 HTTPS 배포 주소를 여세요.

## 3. 이메일 인증번호 활성화

Supabase Authentication의 Email Templates에서 Magic Link 및 Confirm Signup 템플릿에 다음 내용을 넣습니다. Supabase 기본 템플릿이 링크만 제공하는 경우 이 단계가 필요합니다.

```html
<p>QuickNote 로그인 인증번호: <strong>{{ .Token }}</strong></p>
<p><a href="{{ .ConfirmationURL }}">이 기기에서 로그인</a></p>
```

각 기기에서 동일 이메일로 로그인 이메일을 요청한 다음, **요청한 기기의 앱에 해당 이메일의 인증번호를 입력**합니다. PC에서 요청한 localhost 로그인 링크를 휴대폰으로 열 필요가 없습니다. 인증번호는 재사용하지 않습니다. 이메일 발송 제한/스팸함을 확인하고, 일반 서비스 운영 시 Supabase 이메일 발송 설정도 준비하세요.

## 4. PC와 모바일 연결

1. `npm run package:windows` 후 최신 Windows 패키지의 Install.cmd를 실행합니다. 기존 PC 자동 실행 설치를 업데이트합니다.
2. PC 메모지 오른쪽 위 ↗ 버튼 → 전체 메모 → 계정 설정에서 로그인합니다.
3. 기존 PC 메모를 보내려면 **이 기기의 로컬 메모를 계정에 복사**를 누릅니다. 로컬 원본은 남고, 휴지통은 제외되며, 같은 계정에 반복 복사하지 않습니다.
4. 휴대폰에서 HTTPS 주소를 열고 같은 이메일로 로그인합니다. 계정 메모가 동기화됩니다.
5. 이후 각 계정에서 새 메모를 쓰면 저장 후 잠시 뒤 동기화됩니다. 계정 설정의 ‘지금 동기화’로 수동 실행할 수도 있습니다.

## 5. 실제 검증 체크리스트

- PC에서 작성 → 휴대폰에서 본문 확인
- 휴대폰에서 수정 → PC에서 변경 확인
- 삭제/복원/고정이 양쪽에 반영되는지 확인
- 한 기기 오프라인 편집 → 재연결 후 양쪽 내용 확인
- 다른 이메일로 로그인하면 이전 계정의 메모가 보이지 않는지 확인
- Windows 재로그인 후 자동 메모 창이 계정 메모를 여는지 확인

동시 편집은 수정 시간 기반으로 하나가 선택됩니다. 기기 시계 차이가 있거나 같은 메모를 동시에 편집하면 내용이 유실될 수 있습니다. 실제 백엔드와 두 기기가 연결되기 전에는 연동 완료로 볼 수 없습니다.
