'use strict';
(() => {
  const root=document.getElementById('journal'),api=window.JournalAPI;
  const SESSION='web-practice-teacher-v1', PAGE=30;
  let session=null,rows=[],total=0,offset=0,busy=false;
  let filters={search:'',from:'',to:''};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=value=>new Date(value).toLocaleString('ru-RU');
  const duration=row=>{const n=Math.max(0,Math.floor((new Date(row.finished_at)-new Date(row.started_at))/1000));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
  function forget(){session=null;rows=[];total=0;offset=0;try{sessionStorage.removeItem(SESSION);}catch{}}
  function remember(data){session={access_token:data.access_token,expires_at:Date.now()+data.expires_in*1000};try{sessionStorage.setItem(SESSION,JSON.stringify(session));}catch{}}
  function showLogin(message=''){
    root.innerHTML=`<section class="panel login-panel"><span class="eyebrow">ДОСТУП ПРЕПОДАВАТЕЛЯ</span><h1>Твой журнал.</h1><p class="hint">Войди с учётной записью преподавателя, созданной в Supabase.</p>${!api.configured?'<p class="notice">Журнал ещё не подключён. Выполните настройку по файлу SUPABASE.md и заполните config.js.</p>':''}<form id="login"><label for="email">Почта</label><input type="email" id="email" autocomplete="username" required maxlength="254"><label for="password">Пароль</label><input type="password" id="password" autocomplete="current-password" required><button class="btn primary" id="login-button" ${api.configured?'':'disabled'}>Войти в журнал →</button><p id="login-status" class="journal-status error" role="status">${esc(message)}</p></form></section>`;
    document.getElementById('login').onsubmit=async e=>{
      e.preventDefault();if(busy)return;busy=true;
      const button=document.getElementById('login-button');button.disabled=true;
      document.getElementById('login-status').textContent='Проверяем доступ…';
      try{
        const data=await api.login(document.getElementById('email').value.trim(),document.getElementById('password').value);
        document.getElementById('password').value='';
        if(!await api.allowed(data.access_token))throw new Error('Учётная запись не добавлена в список преподавателей. Проверьте шаг 3 в SUPABASE.md.');
        remember(data);busy=false;await load();
      }catch(error){forget();showLogin(error.message);}finally{busy=false;button.disabled=false;}
    };
  }
  function status(message,error=false){const el=document.getElementById('journal-status');if(el){el.textContent=message;el.className='journal-status'+(error?' error':'');}}
  function shell(){
    root.innerHTML=`<div class="journal-head"><div><span class="eyebrow">ПРЕПОДАВАТЕЛЮ / HTML + CSS</span><h1>Журнал результатов</h1><p class="hint">Все попытки участников · новые сверху</p></div><div class="journal-tools"><button class="btn" id="refresh">Обновить</button><button class="btn primary" id="export">Скачать CSV ↓</button><button class="btn" id="logout">Выйти</button></div></div><form class="filters" id="filters"><label for="search">Участник<input type="search" id="search" maxlength="80" value="${esc(filters.search)}" placeholder="Поиск по имени"></label><label for="from">Получено с<input type="date" id="from" value="${esc(filters.from)}"></label><label for="to">По<input type="date" id="to" value="${esc(filters.to)}"></label><button class="btn primary" type="submit">Найти</button></form><p id="journal-status" class="journal-status" role="status"></p><div id="results"></div><p class="privacy-note">Дата получения — время сервера; время прохождения включает перерывы и зависит от часов устройства участника. Каждое повторное прохождение — отдельная запись.</p>`;
    document.getElementById('filters').onsubmit=e=>{e.preventDefault();if(busy)return;const next={search:document.getElementById('search').value,from:document.getElementById('from').value,to:document.getElementById('to').value};if(next.from&&next.to&&next.from>next.to){status('Дата «с» должна быть не позднее даты «по».',true);return;}filters=next;offset=0;load();};
    document.getElementById('refresh').onclick=()=>load();
    document.getElementById('export').onclick=exportCSV;
    document.getElementById('logout').onclick=async()=>{if(busy)return;const token=session.access_token;forget();showLogin();try{await api.logout(token);}catch{ /* Local session has already been removed. */ }};
  }
  function table(){
    const target=document.getElementById('results');
    target.innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th scope="col">Участник</th><th scope="col">Баллы</th><th scope="col">Верно</th><th scope="col">Время</th><th scope="col">Получено</th><th scope="col">Ответы</th></tr></thead><tbody>${rows.map(row=>`<tr><td class="student">${esc(row.student_name)}</td><td><strong>${row.score} / 28</strong></td><td>${Math.round(row.score/28*100)}%</td><td>${duration(row)}</td><td>${esc(date(row.received_at))}</td><td><button class="btn" data-detail="${esc(row.id)}">Посмотреть</button></td></tr>`).join('')}</tbody></table></div><div class="pagination"><button class="btn" id="prev-page" ${offset===0?'disabled':''}>← Назад</button><span>${offset+1}–${offset+rows.length} из ${total}</span><button class="btn" id="next-page" ${offset+rows.length>=total?'disabled':''}>Далее →</button></div>`:'<div class="panel empty">Пока нет результатов по выбранным условиям.</div>';
    target.querySelectorAll('[data-detail]').forEach(button=>button.onclick=()=>detail(button.dataset.detail));
    if(rows.length){document.getElementById('prev-page').onclick=()=>{if(busy)return;offset=Math.max(0,offset-PAGE);load();};document.getElementById('next-page').onclick=()=>{if(busy)return;offset+=PAGE;load();};}
  }
  async function load(){
    if(busy)return;
    if(!session||session.expires_at<=Date.now()){forget();showLogin('Войдите в журнал. Сессия действует ограниченное время.');return;}
    busy=true;shell();status('Загружаем результаты…');
    try{
      if(!await api.allowed(session.access_token))throw new Error('Доступ преподавателя не настроен или отозван.');
      let result=await api.list(session.access_token,{...filters,offset,limit:PAGE});
      if(offset>0&&!result.data.length){offset=0;result=await api.list(session.access_token,{...filters,offset,limit:PAGE});}
      rows=result.data;total=result.total;table();status(`Найдено попыток: ${total}.`);
    }catch(error){rows=[];if(error.status===401||error.status===403){forget();showLogin(error.message);}else status(error.message,true);}finally{busy=false;}
  }
  async function detail(id){
    if(busy)return;busy=true;status('Загружаем ответы…');
    try{
      const row=await api.detail(session.access_token,id);if(!row)throw new Error('Запись недоступна. Обновите журнал.');
      root.innerHTML=`<div class="detail-top"><div><span class="eyebrow">РЕЗУЛЬТАТ УЧАСТНИКА</span><h1>${esc(row.student_name)}</h1><p class="result-subtitle">${row.score} из 28 · ${Math.round(row.score/28*100)}% · ${duration(row)}<br>Получено: ${esc(date(row.received_at))}<br>Без ответа: ${28-row.answered_count}</p></div><button class="btn" id="back">← К журналу</button></div>${row.question_order.map((id,index)=>{
        const q=window.QUESTIONS.find(q=>q.id===id),answer=row.answers[id],correct=answer===q.correct;
        return `<article class="panel review"><span class="status ${correct?'':'wrong'}">${correct?'✓ ВЕРНО':answer===undefined?'○ БЕЗ ОТВЕТА':'× ОШИБКА'} · ВОПРОС ${index+1}</span><h3>${esc(q.text)}</h3><p class="review-answer">Ответ: ${answer===undefined?'не выбран':esc(q.options[answer])}</p>${correct?'':`<p class="review-answer correct">Правильный ответ: ${esc(q.options[q.correct])}</p>`}</article>`;
      }).join('')}`;
      document.getElementById('back').onclick=()=>load();window.scrollTo(0,0);
    }catch(error){if(error.status===401||error.status===403){forget();showLogin(error.message);}else status(error.message,true);}finally{busy=false;}
  }
  const cell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
  async function exportCSV(){
    if(busy)return;busy=true;const button=document.getElementById('export');button.disabled=true;
    try{
      const all=[];let expected=null;const before=new Date().toISOString();
      do{
        status(`Готовим CSV: ${all.length} записей…`);
        const result=await api.list(session.access_token,{...filters,before,offset:all.length,limit:500});
        if(expected===null){expected=result.total;if(expected>20000)throw new Error('Для CSV выберите более узкий период: максимум 20 000 попыток за одну выгрузку.');}
        all.push(...result.data);if(!result.data.length)break;
      }while(all.length<expected);
      // New submissions can move offset-based pages while exporting. Keep each ID once.
      const unique=[...new Map(all.map(row=>[row.id,row])).values()];
      const lines=[['ID попытки','Участник','Баллы из 28','Процент','Без ответа','Время мин:сек','Начало (устройство)','Завершение (устройство)','Получено (сервер)'],...unique.map(row=>[row.id,row.student_name,row.score,Math.round(row.score/28*100),28-row.answered_count,duration(row),date(row.started_at),date(row.finished_at),date(row.received_at)])];
      const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(line=>line.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download='journal-html-css.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      status(`CSV скачан: ${unique.length} записей. Новые попытки, поступившие во время выгрузки, могут потребовать повторного экспорта.`);
    }catch(error){if(error.status===401||error.status===403){forget();showLogin(error.message);}else status(error.message,true);}finally{busy=false;button.disabled=false;}
  }
  try{const saved=JSON.parse(sessionStorage.getItem(SESSION));if(saved&&typeof saved.access_token==='string'&&Number.isFinite(saved.expires_at)&&saved.expires_at>Date.now())session=saved;}catch{}
  session?load():showLogin();
})();
