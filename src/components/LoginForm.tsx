import {useState} from 'react';
import {supabase} from '../lib/sync';

export default function LoginForm(){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <form onSubmit={async e=>{
  e.preventDefault();if(!supabase||busy)return;setBusy(true);setMessage('');
  try{
   const {error}=sent?await supabase.auth.verifyOtp({email,token:code.trim(),type:'email'}):await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});
   if(error)throw error;
   if(!sent){setSent(true);setMessage('이메일의 로그인 링크를 이 기기에서 열거나, 인증번호를 입력하세요.');}
  }catch(error){setMessage(error instanceof Error?error.message:'로그인하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}
 }}>
  <label htmlFor="email">이메일 주소</label><input id="email" type="email" autoComplete="email" required value={email} disabled={sent||busy} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
  {sent&&<><label htmlFor="login-code">이메일 인증번호</label><input id="login-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required value={code} onChange={e=>setCode(e.target.value)} placeholder="인증번호 입력"/></>}
  <button className="new-note" disabled={busy} type="submit">{busy?'처리 중…':sent?'인증번호로 로그인':'로그인 이메일 받기'}</button>
  {sent&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setSent(false);setCode('');setMessage('');}}>이메일 변경 / 다시 보내기</button>}
  {message&&<p role="status">{message}</p>}
 </form>;
}
