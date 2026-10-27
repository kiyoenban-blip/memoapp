import { useEffect, useState } from 'react';
import { ArrowUpRight, Plus, X } from 'lucide-react';
import type { Note } from '../lib/db';
import { title } from '../lib/db';

type Props = {
 note?: Note; loading: boolean; body: string; status: string; error: string;
 onChange: (body: string) => void; onNew: () => void; onClose: () => void;
};
const colors = [{id:'yellow',name:'노랑'},{id:'pink',name:'분홍'},{id:'green',name:'초록'}];
export default function StickyNote({note,loading,body,status,error,onChange,onNew,onClose}:Props){
 const [color,setColor]=useState('yellow');
 useEffect(()=>{try{const stored=localStorage.getItem(`quicknote-color-${note?.id}`);setColor(colors.some(c=>c.id===stored)?stored!:'yellow');}catch{setColor('yellow');}},[note?.id]);
 useEffect(()=>{document.title=note?`${title(body)} · QuickNote`:'QuickNote 메모지';},[note,body]);
 function choose(value:string){setColor(value);try{localStorage.setItem(`quicknote-color-${note?.id}`,value);}catch{/* Color is optional; note storage is handled separately. */}}
 return <main className={`sticky-note sticky-${color}`}>
  <header className="sticky-toolbar"><button aria-label="새 메모" title="새 메모" disabled={loading} onClick={onNew}><Plus size={19}/></button><span>QuickNote</span><a href="/" target="_blank" rel="noopener" aria-label="전체 메모 열기" title="전체 메모 열기"><ArrowUpRight size={18}/></a><button aria-label="메모 창 닫기" title="닫아도 메모는 저장돼요" onClick={onClose}><X size={18}/></button></header>
  {note&&!note.deleted?<textarea className="sticky-paper" aria-label="메모 본문" placeholder="잊기 전에, 적어두세요." value={body} onChange={e=>onChange(e.target.value)} autoFocus spellCheck={false}/>:<div className="sticky-empty">{loading?'메모를 불러오는 중…':note?.deleted?'휴지통에 있는 메모예요. 전체 메모에서 복원해 주세요.':'메모가 없거나 현재 계정에서 열 수 없어요.'}<button disabled={loading} onClick={onNew}>새 메모 쓰기</button></div>}
  <footer className="sticky-footer"><div className="sticky-colors" aria-label="메모지 색상">{colors.map(c=><button key={c.id} className={`swatch swatch-${c.id}`} aria-label={`${c.name} 메모지`} aria-pressed={color===c.id} onClick={()=>choose(c.id)}/>)}</div><span role="status">{error||status}</span></footer>
 </main>;
}
