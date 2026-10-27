import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  StickyNote as StickyIcon,
  ArrowUpRight,
  Check,
  Cloud,
  FileText,
  LayoutList,
  LogOut,
  Pin,
  Plus,
  Search,
  Settings,
  Trash2,
  Undo2,
  WifiOff,
  X,
} from "lucide-react";
import { createNote, db, editNote, LOCAL, title, rememberNote, resumeNote, copyLocalNotes, type Note } from "./lib/db";
import { progress, renderMarkdown, toggleTask } from "./lib/markdown";
import { supabase, syncNotes } from "./lib/sync";
import StickyNote from "./components/StickyNote";
import LoginForm from "./components/LoginForm";
const stickyMode = new URLSearchParams(window.location.search).has("sticky");
const requestedNote = () => new URLSearchParams(window.location.search).get("sticky");
const welcome =
  "# 생각을 놓치지 않도록 🌿\n\nQuickNote에 오신 것을 환영해요.\n떠오르는 생각을 가볍게 적고, 언제든 이어서 써보세요.\n\n## 작은 기록부터 시작해요\n\n- [ ] 오늘 떠오른 아이디어 적기\n- [ ] 이번 주에 하고 싶은 일 정리하기\n- [x] 나만의 메모 공간 만들기\n\n## 쓰는 순간, 저장돼요\n\n입력한 내용은 이 기기에 **자동 저장**됩니다. 인터넷이 없어도 괜찮아요.\n\n> 완벽한 문장보다, 지금의 생각이 더 소중하니까요.\n\n마크다운으로 **강조**하거나, 목록과 체크박스로 생각을 정리할 수 있어요. 오른쪽 위 미리보기를 눌러보세요.\n";
export default function App() {
  const [creating, setCreating] = useState(false);
  const [authReady, setAuthReady] = useState(!supabase);
  const [owner, setOwner] = useState(LOCAL),
    [account, setAccount] = useState("");
  const [id, setId] = useState<string | null>(requestedNote()),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [preview, setPreview] = useState(false),
    [mobile, setMobile] = useState(false),
    [settings, setSettings] = useState(false),
    [notice, setNotice] = useState(""),
    [saveState, setSaveState] = useState("모든 변경사항 저장됨"),
    [syncState, setSyncState] = useState(""),
    [online, setOnline] = useState(navigator.onLine);
  const authOwner = useRef(LOCAL);
  const [importing,setImporting]=useState(false);
  const searchRef = useRef<HTMLInputElement>(null),
    editorRef = useRef<HTMLTextAreaElement>(null);
  const notes = useLiveQuery(
    () => db.notes.where("owner").equals(owner).toArray(),
    [owner],
  );
  const selected = notes?.find((n) => n.id === id);
  const [draft, setDraft] = useState("");
  const active = useRef<string | null>(null);
  const writes = useRef(Promise.resolve());
  const revision = useRef(0);
  const localDrafts = useRef(new Map<string, string>());
  const report = (e: unknown) =>
    setNotice(
      e instanceof Error
        ? e.message
        : "작업을 완료하지 못했습니다. 다시 시도해 주세요.",
    );
  useEffect(() => {
    if (!selected) return;
    const pending = localDrafts.current.get(selected.id);
    if (pending !== undefined) {
      if (selected.body === pending) localDrafts.current.delete(selected.id);
      else return;
    }
    rememberNote(selected);
    active.current = selected.id;
    setDraft(selected.body);
  }, [selected]);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthReady(true);
      setOwner(session?.user.id ?? LOCAL);
      setAccount(session?.user.email ?? "");
      const nextOwner=session?.user.id??LOCAL;
      if(authOwner.current!==nextOwner){
        authOwner.current=nextOwner;
        setId(stickyMode ? (_event === "INITIAL_SESSION" ? requestedNote() : "auto") : null);
        active.current=null;
        setMobile(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!stickyMode || id !== "auto" || !authReady) return;
    let cancelled = false;
    resumeNote(owner).then(note => {
      if (cancelled) return;
      history.replaceState(null, "", `?sticky=${encodeURIComponent(note.id)}`);
      setId(note.id);
      setDraft(note.body);
    }).catch(error => { if (!cancelled) report(error); });
    return () => { cancelled = true; };
  }, [owner, id, authReady]);
  const sync = useCallback(async () => {
    if (owner === LOCAL) return;
    setSyncState("동기화 중…");
    try {
      await writes.current;
      await syncNotes(owner);
      setSyncState("동기화 완료");
    } catch {
      setSyncState("동기화 대기 · 다시 시도");
    }
  }, [owner]);
  useEffect(() => {
    const on = () => {
      setOnline(true);
      void sync();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const timer = setInterval(() => void sync(), 15000);
    void sync();
    const channel =
      supabase && owner !== LOCAL
        ? supabase
            .channel(`notes-${owner}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "notes",
                filter: `user_id=eq.${owner}`,
              },
              () => void sync(),
            )
            .subscribe()
        : null;
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      if (channel) void supabase!.removeChannel(channel);
    };
  }, [sync, owner]);
  useEffect(()=>{
    if(owner===LOCAL||!online||!notes?.some(n=>n.dirty))return;
    const timer=setTimeout(()=>void sync(),800);
    return ()=>clearTimeout(timer);
  },[notes,owner,online,sync]);
  const open = (n: Note) => {
    setId(n.id);
    if(stickyMode) history.replaceState(null, "", `?sticky=${encodeURIComponent(n.id)}`);
    active.current = n.id;
    setDraft(localDrafts.current.get(n.id) ?? n.body);
    setMobile(true);
    setPreview(false);
  };
  const add = useCallback(
    async (body = "") => {
      setCreating(true);
      try {
        const n = await createNote(owner, body);
        setFilter("all");
        setQuery("");
        open(n);
        setTimeout(() => editorRef.current?.focus(), 0);
      } catch (e) {
        report(e);
      } finally {
        setCreating(false);
      }
    },
    [owner],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMobile(false);
        searchRef.current?.focus();
      }
      if (e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void add();
      }
      if (e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPreview((v) => !v);
      }
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        void sync();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [add, sync]);
  function save(body: string) {
    if (!selected) return;
    setDraft(body);
    localDrafts.current.set(selected.id, body);
    setSaveState("저장 중…");
    const noteId = selected.id;
    const version = ++revision.current;
    writes.current = writes.current
      .then(() => editNote(noteId, { body }))
      .then(() => {
        if (version === revision.current) setSaveState("모든 변경사항 저장됨");
      })
      .catch((e) => {
        setSaveState("저장 실패 · 내용을 복사해 주세요");
        report(e);
      });
  }
  async function change(changes: Partial<Pick<Note, "pinned" | "deleted">>) {
    if (!selected) return;
    try {
      await writes.current;
      await editNote(selected.id, changes);
      if ("deleted" in changes) {
        setId(null);
        setMobile(false);
      }
    } catch (e) {
      report(e);
    }
  }
  const visible = (notes ?? [])
    .filter((n) =>
      filter === "trash"
        ? n.deleted
        : !n.deleted && (filter !== "pinned" || n.pinned),
    )
    .filter((n) =>
      n.body.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const count = (notes ?? []).filter((n) => !n.deleted).length;
  const task = progress(draft);
  function popOut() {
    if(!selected)return;
    const popup=window.open(`?sticky=${encodeURIComponent(selected.id)}`,`quicknote-${selected.id}`,"popup=yes,width=360,height=380,resizable=yes,scrollbars=yes");
    if(popup)popup.focus();else setNotice("메모 창을 열려면 브라우저에서 팝업을 허용해 주세요.");
  }
  if(stickyMode)return <StickyNote note={creating ? undefined : selected} loading={creating || notes===undefined} body={draft} status={saveState} error={notice} onChange={save} onNew={()=>void add()} onClose={()=>{void writes.current.then(()=>{window.close();});}}/>;
  return (
    <div className="app">
      <aside className="rail">
        <a
          className="brand"
          href="#"
          aria-label="QuickNote 홈"
          onClick={(e) => {
            e.preventDefault();
            setMobile(false);
          }}
        >
          <span className="logo">
            <FileText size={22} />
          </span>
          <span>
            QuickNote<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">나만의 작은 기록 공간</div>
        <button className="new-note" onClick={() => void add()}>
          <Plus size={18} />새 메모<span>⇧ ⌘ N</span>
        </button>
        <nav>
          <button
            className={filter === "all" ? "nav active" : "nav"}
            onClick={() => {
              setFilter("all");
              setMobile(false);
            }}
          >
            <LayoutList size={18} />
            모든 메모<b>{count}</b>
          </button>
          <button
            className={filter === "pinned" ? "nav active" : "nav"}
            onClick={() => {
              setFilter("pinned");
              setMobile(false);
            }}
          >
            <Pin size={18} />
            고정된 메모
            <b>{notes?.filter((n) => n.pinned && !n.deleted).length ?? 0}</b>
          </button>
          <button
            className={filter === "trash" ? "nav active" : "nav"}
            onClick={() => {
              setFilter("trash");
              setMobile(false);
            }}
          >
            <Trash2 size={18} />
            휴지통
          </button>
        </nav>
        <button
          className="icon-button mobile-settings"
          aria-label="계정 설정"
          onClick={() => setSettings(true)}
        >
          <Settings size={18} />
        </button>
        <div className="rail-bottom">
          <div className="local-card">
            <span className="status-dot" />
            <strong>
              {owner === LOCAL ? "내 기기에 안전하게" : "어디서나 이어서"}
            </strong>
            <p>
              {owner === LOCAL
                ? "메모는 이 브라우저에 저장돼요."
                : "로컬 저장 후 서버와 동기화해요."}
            </p>
            <button onClick={() => setSettings(true)}>
              {owner === LOCAL ? "기기 간 동기화 연결" : "계정 설정"}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="profile" onClick={() => setSettings(true)}>
            <span className="avatar">
              {account ? account[0].toUpperCase() : "Q"}
            </span>
            <span>
              {account || "나의 워크스페이스"}
              <small>{owner === LOCAL ? "로컬 모드" : "클라우드 연결됨"}</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <section className={"notes-panel " + (mobile ? "mobile-hidden" : "")}>
        <header className="list-heading">
          <div>
            <span className="eyebrow">YOUR LITTLE SPACE</span>
            <h1>
              {filter === "trash"
                ? "휴지통"
                : filter === "pinned"
                  ? "고정된 메모"
                  : "모든 메모"}
              <span>{visible.length}</span>
            </h1>
          </div>
          <button
            className="icon-button mobile-add"
            aria-label="새 메모"
            onClick={() => void add()}
          >
            <Plus size={21} />
          </button>
        </header>
        <div className="search">
          <Search size={17} />
          <input
            ref={searchRef}
            aria-label="메모 검색"
            placeholder="메모 속 생각 찾기…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </div>
        <div className="list-caption">
          <span>{query ? "검색 결과" : "나의 기록"}</span>
          <span>최근 수정순</span>
        </div>
        <div className="note-list">
          {visible.map((n) => {
            const p = progress(n.body);
            return (
              <button
                key={n.id}
                className={"note-card " + (n.id === id ? "selected" : "")}
                onClick={() => open(n)}
              >
                <div className="note-title">
                  {n.pinned && <Pin size={13} />}
                  <strong>{title(n.body)}</strong>
                </div>
                <p>
                  {n.body
                    .split("\n")
                    .filter((x) => x.trim())
                    .slice(1)
                    .join(" ")
                    .replace(/[#*>`\[\]]/g, "")
                    .slice(0, 100) || "빈 페이지에 생각을 담아보세요."}
                </p>
                <div className="note-meta">
                  <time>
                    {new Date(n.updatedAt).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  {p.total > 0 && (
                    <span>
                      <Check size={12} />
                      {p.done}/{p.total}
                    </span>
                  )}
                  <span className="tiny-dot" />
                </div>
              </button>
            );
          })}
          {visible.length === 0 && (
            <div className="empty-list">
              <FileText size={30} />
              <p>
                {query
                  ? "찾는 메모가 없어요"
                  : filter === "trash"
                    ? "휴지통이 비어 있어요"
                    : "아직 기록이 없어요"}
              </p>
              <small>
                {query
                  ? "다른 검색어를 입력해 보세요."
                  : "작은 생각 하나부터 시작해 보세요."}
              </small>
            </div>
          )}
        </div>
        <footer className="list-footer">
          <span className="status-dot" />
          {online
            ? "기록하기 좋은 순간이에요"
            : "오프라인에서도 기록할 수 있어요"}
        </footer>
      </section>
      <main className={"editor-panel " + (!mobile ? "mobile-hidden" : "")}>
        {selected ? (
          <>
            <header className="editor-toolbar">
              <div className="toolbar-left">
                <button
                  className="icon-button back"
                  aria-label="목록으로"
                  onClick={() => setMobile(false)}
                >
                  <ArrowLeft size={19} />
                </button>
                <span className="save-status">
                  <Check size={14} />
                  {saveState}
                </span>
              </div>
              <div className="toolbar-actions">
                <button className="sticky-launch" onClick={popOut} title="작은 메모 창으로 띄우기" aria-label="메모지로 띄우기"><StickyIcon size={17}/><span>메모지로 띄우기</span></button>
                <div className="mode-switch">
                  <button
                    className={!preview ? "chosen" : ""}
                    onClick={() => setPreview(false)}
                  >
                    편집
                  </button>
                  <button
                    className={preview ? "chosen" : ""}
                    onClick={() => setPreview(true)}
                  >
                    미리보기
                  </button>
                </div>
                <button
                  className={
                    "icon-button " + (selected.pinned ? "is-pinned" : "")
                  }
                  aria-label={selected.pinned ? "고정 해제" : "메모 고정"}
                  onClick={() => void change({ pinned: !selected.pinned })}
                >
                  <Pin size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={selected.deleted ? "메모 복원" : "메모 삭제"}
                  onClick={() => void change({ deleted: !selected.deleted })}
                >
                  {selected.deleted ? (
                    <Undo2 size={18} />
                  ) : (
                    <Trash2 size={18} />
                  )}
                </button>
              </div>
            </header>
            <div className="document">
              <div className="document-meta">
                <span>MY NOTE</span>
                <span>·</span>
                <time>
                  {new Date(selected.createdAt).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </div>
              {selected.deleted && (
                <div className="trash-banner">
                  휴지통에 있는 메모입니다. 복원하면 다시 편집할 수 있어요.
                </div>
              )}
              {preview ? (
                <article
                  className="markdown"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (
                      target instanceof HTMLInputElement &&
                      target.dataset.task !== undefined &&
                      !selected.deleted
                    )
                      save(toggleTask(draft, Number(target.dataset.task)));
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) }}
                />
              ) : (
                <textarea
                  ref={editorRef}
                  className="writing-area"
                  disabled={creating}
                  aria-label="메모 본문"
                  placeholder={
                    "제목을 적어보세요\n\n지금 떠오르는 생각은 무엇인가요?"
                  }
                  value={draft}
                  readOnly={selected.deleted}
                  onChange={(e) => save(e.target.value)}
                  spellCheck={false}
                />
              )}
            </div>
            <footer className="editor-footer">
              <span>
                마크다운 지원 <span className="footer-divider">·</span>{" "}
                {draft.length.toLocaleString()}자
              </span>
              <span>
                {task.total > 0
                  ? `할 일 ${task.done}/${task.total} 완료`
                  : "천천히, 나의 속도로"}
                <span className="leaf">✧</span>
              </span>
            </footer>
          </>
        ) : (
          <div className="welcome">
            <div className="welcome-icon">
              <FileText size={36} strokeWidth={1.4} />
            </div>
            <span className="eyebrow">A THOUGHT, A LITTLE SPACE</span>
            <h2>생각이 머무는 곳.</h2>
            <p>
              스쳐 가는 아이디어부터 소중한 일상까지.
              <br />
              가볍게 적어두면, 언제든 다시 만날 수 있어요.
            </p>
            <button className="new-note" onClick={() => void add()}>
              첫 생각 기록하기
              <Plus size={18} />
            </button>
            <button className="text-button" onClick={() => void add(welcome)}>
              사용 가이드 메모 열기 <ArrowUpRight size={14} />
            </button>
            <div className="welcome-foot">
              자동 저장 <span>·</span> 오프라인 지원 <span>·</span> 나만의 공간
            </div>
          </div>
        )}
        <button
          className="sync-indicator"
          onClick={() => (owner === LOCAL ? setSettings(true) : void sync())}
        >
          {online ? <Cloud size={14} /> : <WifiOff size={14} />}{" "}
          {owner === LOCAL ? "로컬 모드" : syncState || "동기화 준비"}
        </button>
      </main>
      {notice && (
        <div role="alert" className="toast">
          {notice}
          <button aria-label="알림 닫기" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="설정 닫기"
              onClick={() => setSettings(false)}
            >
              <X size={20} />
            </button>
            <Cloud size={30} />
            <h2 id="settings-title">어디서나, 나의 메모</h2>
            <p>
              로그인하면 휴대폰과 컴퓨터에서
              <br />
              같은 계정의 메모를 이어서 쓸 수 있어요.
            </p>
            {!supabase ? (
              <div className="setup-info">
                현재 로컬 전용 모드입니다. 기기 간 동기화를 사용하려면 README의
                Supabase 설정을 완료해 주세요.
              </div>
            ) : account ? (
              <>
                <p>{account}</p>
                <p>PC와 모바일에서 이 이메일로 로그인하면 같은 메모가 표시됩니다.</p>
                <button className="new-note" disabled={importing} onClick={async()=>{
                  setImporting(true);
                  try{const count=await copyLocalNotes(owner);setNotice(count?`로컬 메모 ${count}개를 이 계정으로 복사했습니다. 동기화를 진행합니다.`:'새로 복사할 로컬 메모가 없습니다.');await sync();}catch(e){report(e);}finally{setImporting(false);}
                }}>{importing?'복사 중…':'이 기기의 로컬 메모를 계정에 복사'}</button>
                <button className="text-button" onClick={()=>void sync()}>지금 동기화 · {syncState||'준비됨'}</button>
                <button
                  className="new-note"
                  onClick={() =>
                    void supabase!.auth.signOut().then(({ error }) => {
                      if (error) report(error);
                      else setSettings(false);
                    })
                  }
                >
                  <LogOut size={16} />
                  로그아웃
                </button>
              </>
            ) : (
              <LoginForm />
            )}
            <small>
              로컬 메모는 자동 업로드되지 않습니다. 로그인 후 복사 버튼을 누르면 현재 계정으로 업로드되며, 원본은 이 기기에 남습니다. 이미 복사한 메모는 다시 복사하지 않습니다.
            </small>
            <div className="shortcuts">
              <strong>키보드 단축키</strong>
              <span>
                새 메모 <kbd>Ctrl/⌘ Shift N</kbd>
              </span>
              <span>
                검색 <kbd>Ctrl/⌘ K</kbd>
              </span>
              <span>
                미리보기 <kbd>Ctrl/⌘ Shift P</kbd>
              </span>
              <span>
                동기화 <kbd>Ctrl/⌘ S</kbd>
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
