import {test,expect} from '@playwright/test';
test('sticky popup shares edits, remembers color and survives the main window closing',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'첫 생각 기록하기'}).click();
 await page.getByRole('textbox',{name:'메모 본문'}).fill('장보기\n우유와 달걀');
 await expect(page.getByText('모든 변경사항 저장됨')).toBeVisible();
 const popupPromise=page.waitForEvent('popup');
 await page.getByRole('button',{name:'메모지로 띄우기'}).click();
 const sticky=await popupPromise;
 await expect(sticky.getByRole('textbox',{name:'메모 본문'})).toHaveValue('장보기\n우유와 달걀');
 await sticky.getByRole('textbox',{name:'메모 본문'}).fill('장보기\n우유와 달걀\n빵');
 await expect(page.getByRole('textbox',{name:'메모 본문'})).toHaveValue('장보기\n우유와 달걀\n빵');
 await sticky.getByRole('button',{name:'분홍 메모지'}).click();
 await page.close();
 await sticky.reload();
 await expect(sticky.getByRole('button',{name:'분홍 메모지'})).toHaveAttribute('aria-pressed','true');
 await expect(sticky.getByRole('textbox',{name:'메모 본문'})).toHaveValue('장보기\n우유와 달걀\n빵');
 await sticky.setViewportSize({width:360,height:380});
 expect(await sticky.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await sticky.getByRole('button',{name:'새 메모',exact:true}).click();
 await sticky.getByRole('textbox',{name:'메모 본문'}).fill('새 포스트잇');
 await expect(sticky.getByRole('status')).toHaveText('모든 변경사항 저장됨');
 await sticky.reload();
 await expect(sticky.getByRole('textbox',{name:'메모 본문'})).toHaveValue('새 포스트잇');
});
test('blocked popup gives actionable feedback',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'첫 생각 기록하기'}).click();
 await page.evaluate(()=>{window.open=()=>null;});
 await page.getByRole('button',{name:'메모지로 띄우기'}).click();
 await expect(page.getByRole('alert')).toContainText('팝업을 허용');
});

test('startup opens a writable note immediately and resumes it next launch',async({page})=>{
 await page.goto('/?sticky=auto');
 const editor=page.getByRole('textbox',{name:'메모 본문'});
 await expect(editor).toBeVisible();await editor.fill('로그인 후 바로 기록');
 await expect(page.getByRole('status')).toHaveText('모든 변경사항 저장됨');
 const noteUrl=page.url();
 await page.goto('/?sticky=auto');await expect(editor).toHaveValue('로그인 후 바로 기록');
 expect(page.url()).toBe(noteUrl);
 await page.goto('/');await expect(page.getByRole('button').filter({hasText:'로그인 후 바로 기록'})).toHaveCount(1);
});
