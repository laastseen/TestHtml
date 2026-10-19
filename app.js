'use strict';
(() => {
  const questions = window.QUESTIONS;
  const app = document.getElementById('app');
  const KEY = 'web-practice-html-css-v1';
  const letters = ['А', 'Б', 'В', 'Г'];
  let state = null;
  let canSave = true;
  let confirmFinish = false;
  let confirmRestart = false;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count = () => Object.keys(state.answers).length;
  const elapsed = () => Math.max(0, Math.floor(((state.finishedAt || Date.now()) - state.startedAt) / 1000));
  const formatTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const score = () => questions.filter(q => state.answers[q.id] === q.correct).length;
  function valid(s) {
    return s && s.version === 1 && typeof s.name === 'string' && s.name.trim().length > 0 && s.name.length <= 80 &&
      Array.isArray(s.order) && s.order.length === questions.length && new Set(s.order).size === questions.length &&
      s.order.every(id => questions.some(q => q.id === id)) && Number.isInteger(s.current) && s.current >= 0 && s.current < questions.length &&
      s.answers && typeof s.answers === 'object' && !Array.isArray(s.answers) && Object.entries(s.answers).every(([id, answer]) => questions.some(q => String(q.id) === id) && Number.isInteger(answer) && answer >= 0 && answer < 4) &&
      Number.isFinite(s.startedAt) && s.startedAt > 0 && (s.finishedAt === null || Number.isFinite(s.finishedAt) && s.finishedAt >= s.startedAt);
  }
  try { const saved = JSON.parse(localStorage.getItem(KEY)); if (valid(saved)) state = saved; } catch { canSave = false; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); canSave = true; } catch { canSave = false; }
  }
  window.saveAttempt = save;
  const storageNote = () => canSave ? '' : '<p class="storage-warning" role="status">Браузер не разрешил сохранить прогресс. Не закрывайте эту вкладку до завершения теста.</p>';
  function shuffled(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function start(name, random) {
    if (!name.trim()) {
      const input = document.getElementById('name');
      input.setCustomValidity('Введите имя, чтобы начать тест.');
      input.reportValidity();
      input.focus();
      return;
    }
    state = {attemptId:crypto.randomUUID(), version:1, name:name.trim().slice(0,80), order:random ? shuffled(questions.map(q => q.id)) : questions.map(q => q.id), current:0, answers:{}, startedAt:Date.now(), finishedAt:null};
    confirmFinish = false; confirmRestart = false; save(); renderQuiz();
  }
  function intro() {
    app.innerHTML = `<section class="intro"><div><span class="tag">ПРОВЕРЬ СВОЮ БАЗУ</span><h1>Всё начинается<br>с <em>HTML и CSS.</em></h1><p class="lead">Теги, стили и структура страницы. Узнай, насколько уверенно ты ориентируешься в основах веб-разработки.</p><div class="facts"><div class="fact"><strong>28</strong><span>вопросов</span></div><div class="fact"><strong>1 из 4</strong><span>верный ответ</span></div><div class="fact"><strong>∞</strong><span>без спешки</span></div></div><form id="start-form" class="start-form"><label class="name" for="name">Как тебя зовут? <span class="muted">Обязательно</span></label><input id="name" type="text" autocomplete="name" maxlength="80" required pattern=".*\\S.*" placeholder="Имя и фамилия"><label class="check"><input id="random" type="checkbox" checked>Перемешать порядок вопросов</label><button class="btn primary wide" type="submit">Начать тест <span aria-hidden="true">↗</span></button><p class="hint">Без регистрации и ограничения времени.<br>После завершения имя, ответы и результат отправятся преподавателю в Supabase. Регистрация участника не нужна.</p>${storageNote()}</form></div><div class="visual" aria-hidden="true"><div class="code-window"><div class="dots"><i></i><i></i><i></i></div><pre><b>&lt;main&gt;</b>\n  &lt;h1&gt;Привет, мир!&lt;/h1&gt;\n  &lt;p&gt;Начни с основ.&lt;/p&gt;\n<b>&lt;/main&gt;</b>\n\n<em>.your-skills</em> {\n  display: <b>сonfidence</b>;\n  potential: <b>unlimited</b>;\n}</pre></div><div class="floating"><strong>✓</strong> Следующий шаг — практика</div></div></section><section class="features"><div><b>01 / В своём темпе</b><p>Возвращайся к любому вопросу и меняй ответ до завершения.</p></div><div><b>02 / Прогресс под рукой</b><p>Ответы сохраняются в этом браузере. Можно продолжить позже.</p></div><div><b>03 / Понятный результат</b><p>Увидишь баллы, процент правильных ответов и свои ошибки.</p></div></section>`;
    document.getElementById('name').addEventListener('input', () => document.getElementById('name').setCustomValidity(''));
    document.getElementById('start-form').addEventListener('submit', e => {e.preventDefault(); start(document.getElementById('name').value,document.getElementById('random').checked);});
  }
  function navigate(index) {state.current = index; confirmFinish = false; save(); renderQuiz(); document.getElementById('question-title').focus();}
  function renderQuiz() {
    const q = questions.find(q => q.id === state.order[state.current]);
    const answered = count();
    app.innerHTML = `<div class="quiz-header"><div><span class="eyebrow">ПРАКТИКА / HTML + CSS</span><h1>${state.name ? `${esc(state.name)}, проверим знания` : 'Шаг за шагом — к результату'}</h1></div><span class="time" title="Время с начала попытки, включая перерывы"><span aria-hidden="true">◷ </span><span id="timer">${formatTime(elapsed())}</span></span></div><div class="quiz-layout"><section class="panel question-panel">${confirmFinish ? `<div class="notice" role="status"><p>${answered < 28 ? `Осталось без ответа: ${28-answered}. Они будут засчитаны как ошибки.` : 'Все ответы выбраны. После завершения изменить их будет нельзя.'}</p><button class="btn primary" id="confirm-finish">Завершить и показать результат</button><button class="btn" id="cancel-finish">Вернуться к вопросам</button></div>` : ''}<div class="question-num">ВОПРОС ${state.current+1} ИЗ 28 · ${q.id <= 12 || q.id >= 18 && q.id <= 26 ? 'HTML' : 'CSS'}</div><h2 id="question-title" tabindex="-1">${esc(q.text)}</h2><div class="options" role="radiogroup" aria-labelledby="question-title">${q.options.map((option,i) => `<label class="option"><input type="radio" name="answer" value="${i}" ${state.answers[q.id]===i?'checked':''}><span><strong>${letters[i]}.</strong> ${esc(option)}</span></label>`).join('')}</div><div class="actions"><button class="btn" id="previous" ${state.current===0?'disabled':''}>← Назад</button><button class="btn primary" id="next">${state.current===27?'Завершить тест':'Далее →'}</button></div>${storageNote()}</section><aside class="panel"><div class="sidebar-title">Твой прогресс</div><span class="hint">Отвечено ${answered} из 28</span><div class="bar" role="progressbar" aria-label="Количество ответов" aria-valuenow="${answered}" aria-valuemin="0" aria-valuemax="28"><span style="width:${answered/28*100}%"></span></div><nav class="numbers" aria-label="Перейти к вопросу">${state.order.map((id,i) => `<button class="number ${state.answers[id]!==undefined?'answered':''} ${state.current===i?'current':''}" data-index="${i}" aria-label="Вопрос ${i+1}${state.answers[id]!==undefined?', ответ выбран':''}" ${state.current===i?'aria-current="step"':''}>${i+1}</button>`).join('')}</nav><p class="hint sidebar-note">Зелёным отмечены вопросы с ответом. Можно вернуться к любому из них.</p><button class="btn small-btn" id="finish">Завершить тест</button><p class="hint sidebar-note">Прогресс хранится только в этом браузере.</p></aside></div>`;
    app.querySelectorAll('input[name=answer]').forEach(input => input.addEventListener('change', () => {
      state.answers[q.id] = Number(input.value); save();
      const focusedValue = input.value;
      renderQuiz();
      app.querySelector(`input[value="${focusedValue}"]`).focus();
    }));
    app.querySelectorAll('[data-index]').forEach(button => button.addEventListener('click', () => navigate(Number(button.dataset.index))));
    document.getElementById('previous').onclick = () => navigate(state.current-1);
    document.getElementById('next').onclick = () => state.current===27 ? requestFinish() : navigate(state.current+1);
    document.getElementById('finish').onclick = requestFinish;
    if (confirmFinish) {
      document.getElementById('cancel-finish').onclick = () => {confirmFinish=false;renderQuiz();};
      document.getElementById('confirm-finish').onclick = () => {state.finishedAt=Date.now();save();renderResult();window.scrollTo(0,0);};
    }
  }
  function requestFinish() { confirmFinish=true; renderQuiz(); document.getElementById('confirm-finish').focus(); app.querySelector('.notice').scrollIntoView({block:'center',behavior:'smooth'}); }
  function renderResult() {
    const points = score();
    app.innerHTML = `<section class="result-hero"><span class="tag">ТЕСТ ЗАВЕРШЁН</span><div class="score">${points}<small> / 28</small></div><h1>${points>=24?'Отличная база!':points>=16?'Хорошее начало!':'Первый шаг сделан!'}</h1><p class="result-subtitle">${state.name?`${esc(state.name)} · `:''}Правильных ответов: ${Math.round(points/28*100)}% · Время: ${formatTime(elapsed())}<br>Без ответа: ${28-count()}. Ниже можно разобрать каждый вопрос.</p><div class="result-actions"><button class="btn primary" id="download">Скачать результат ↓</button><button class="btn" id="restart">Пройти ещё раз ↗</button></div>${confirmRestart?'<div class="notice" role="status"><p>Начать новую попытку? Текущий результат в браузере будет заменён. Если отправка в журнал не удалась, сначала повторите её или скачайте результат.</p><button class="btn primary" id="confirm-restart">Начать новую попытку</button><button class="btn" id="cancel-restart">Оставить результат</button></div>':''}<div id="journal-sync" class="sync-box" role="status" aria-live="polite"></div>${storageNote()}</section><h2 class="review-heading">Разбор ответов</h2>${state.order.map((id,index) => {
      const q=questions.find(q=>q.id===id), answer=state.answers[id], correct=answer===q.correct;
      return `<article class="panel review"><span class="status ${correct?'':'wrong'}">${correct?'✓ ВЕРНО':answer===undefined?'○ БЕЗ ОТВЕТА':'× ОШИБКА'} · ВОПРОС ${index+1}</span><h3>${esc(q.text)}</h3><p class="review-answer">Твой ответ: ${answer===undefined?'не выбран':esc(q.options[answer])}</p>${correct?'':`<p class="review-answer correct">Правильный ответ: ${esc(q.options[q.correct])}</p>`}</article>`;
    }).join('')}`;
    window.syncJournal(state);
    document.getElementById('download').onclick=download;
    document.getElementById('restart').onclick=()=>{confirmRestart=true;renderResult();document.getElementById('confirm-restart').focus();};
    if(confirmRestart){
      document.getElementById('cancel-restart').onclick=()=>{confirmRestart=false;renderResult();};
      document.getElementById('confirm-restart').onclick=()=>{state=null;try{localStorage.removeItem(KEY);}catch{}intro();window.scrollTo(0,0);};
    }
  }
  function download() {
    const lines=['HTML и CSS — результат теста',`Участник: ${state.name||'Не указан'}`,`Завершено: ${new Date(state.finishedAt).toLocaleString('ru-RU')}`,`Результат: ${score()} из 28 (${Math.round(score()/28*100)}%)`,`Без ответа: ${28-count()}`,`Время с начала попытки (включая перерывы): ${formatTime(elapsed())}`,''];
    state.order.forEach((id,index)=>{const q=questions.find(q=>q.id===id),answer=state.answers[id];lines.push(`${index+1}. ${q.text}`,`Ответ: ${answer===undefined?'Не выбран':q.options[answer]}`,`Правильный ответ: ${q.options[q.correct]}`,answer===q.correct?'Верно':'Неверно','');});
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='html-css-result.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  setInterval(()=>{const timer=document.getElementById('timer');if(timer&&state&&!state.finishedAt)timer.textContent=formatTime(elapsed());},1000);
  if(state) state.finishedAt ? renderResult() : renderQuiz(); else intro();
})();
