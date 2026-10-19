'use strict';
(() => {
  let sending=false;
  function status(state,text,kind='',retry=false){
    const node=document.getElementById('journal-sync');if(!node||node.dataset.attempt!==state.attemptId)return;
    node.className='sync-box '+kind;node.replaceChildren();
    const p=document.createElement('p');p.textContent=text;node.appendChild(p);
    if(retry){const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Повторить отправку';button.onclick=()=>window.syncJournal(state);node.appendChild(button);}
  }
  window.syncJournal=async state=>{
    if(!state.attemptId){state.attemptId=crypto.randomUUID();window.saveAttempt();}
    const node=document.getElementById('journal-sync');if(!node)return;node.dataset.attempt=state.attemptId;
    if(state.journalSaved){status(state,'✓ Результат сохранён в журнале преподавателя.','success');return;}
    if(!window.JournalAPI.configured){status(state,'Журнал пока не настроен. Результат сохранён только в этом браузере.','pending');return;}
    if(sending){status(state,'Отправляем результат преподавателю…');return;}
    sending=true;status(state,'Отправляем результат преподавателю…');
    try{
      const id=await window.JournalAPI.submit(state);
      if(id!==state.attemptId)throw new Error('Сервер не подтвердил сохранение.');
      state.journalSaved=true;window.saveAttempt();status(state,'✓ Результат сохранён в журнале преподавателя.','success');
    }catch(error){status(state,`Не удалось отправить результат. ${error.message} Не начинайте новую попытку, пока не повторите отправку.`, 'pending',true);}
    finally{sending=false;}
  };
  window.addEventListener('online',()=>{const node=document.querySelector('#journal-sync button');if(node)node.click();});
})();
