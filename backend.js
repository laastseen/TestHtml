'use strict';
(() => {
  const config = window.JOURNAL_CONFIG || {};
  const url = String(config.url || '').replace(/\/$/, '');
  const publicKey = String(config.publicKey || '');
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && publicKey.length > 20 && !publicKey.startsWith('sb_secret_');
  async function request(path, { method='GET', body, token, count=false }={}) {
    if (!configured) throw new Error('Сначала заполните config.js по инструкции SUPABASE.md.');
    const headers = {apikey:publicKey, 'Content-Type':'application/json'};
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (publicKey.startsWith('eyJ')) headers.Authorization = `Bearer ${publicKey}`;
    if (count) headers.Prefer = 'count=exact';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url+path, {method, headers, body:body===undefined?undefined:JSON.stringify(body), signal:controller.signal, cache:'no-store', credentials:'omit'});
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = response.status===404 && data?.code==='PGRST202' ? 'Журнал ещё не настроен. Сообщите преподавателю: нужно выполнить настройку по SUPABASE.md.' : data?.code==='invalid_credentials' || data?.error_code==='invalid_credentials' ? 'Неверная почта или пароль.' : response.status===401 ? 'Сессия истекла или неверные данные входа. Войдите ещё раз.' : response.status===403 ? 'Нет доступа. Проверьте права преподавателя в Supabase.' : 'Сервис не принял запрос. Проверьте соединение и настройку Supabase.';
        throw Object.assign(new Error(message), {status:response.status});
      }
      return {data, total: count ? Number(response.headers.get('content-range')?.split('/')[1]) : null};
    } catch(error) {
      if (error.name==='AbortError') throw new Error('Сервер не ответил вовремя. Попробуйте ещё раз.');
      if (error instanceof TypeError) throw new Error('Нет связи с Supabase. Проверьте интернет и повторите отправку.');
      throw error;
    } finally {clearTimeout(timeout);}
  }
  window.JournalAPI = {
    configured,
    async submit(state) {
      return (await request('/rest/v1/rpc/submit_attempt',{method:'POST',body:{
        p_id:state.attemptId, p_name:state.name, p_answers:state.answers, p_order:state.order,
        p_started_at:new Date(state.startedAt).toISOString(), p_finished_at:new Date(state.finishedAt).toISOString()
      }})).data;
    },
    async login(email,password) {
      return (await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}})).data;
    },
    async allowed(token) {return (await request('/rest/v1/teachers?select=user_id&limit=1',{token})).data.length>0;},
    async logout(token) {await request('/auth/v1/logout',{method:'POST',token});},
    async list(token,{search='',from='',to='',before='',offset=0,limit=30}={}) {
      const query=new URLSearchParams({select:'id,student_name,score,answered_count,started_at,finished_at,received_at',order:'received_at.desc,id.desc',offset:String(offset),limit:String(limit)});
      if(search.trim()) query.set('student_name',`ilike.*${search.trim().replace(/[*,()%_\\]/g,' ')}*`);
      if(from) query.append('received_at',`gte.${new Date(from+'T00:00:00').toISOString()}`);
      if(to) {const next=new Date(to+'T00:00:00');next.setDate(next.getDate()+1);query.append('received_at',`lt.${next.toISOString()}`);}
      if(before) query.append('received_at',`lte.${before}`);
      return request('/rest/v1/attempts?'+query,{token,count:true});
    },
    async detail(token,id) {return (await request('/rest/v1/attempts?'+new URLSearchParams({select:'*',id:`eq.${id}`,limit:'1'}),{token})).data[0];}
  };
})();
