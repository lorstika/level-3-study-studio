'use strict';
const KEY = 'level3-study-v1';
const allLessons = COURSES.flatMap(c => c.lessons);
const lessonById = new Map(allLessons.map(l => [l.id, l]));
const $ = selector => document.querySelector(selector);
const esc = mathEscape;
const testKey = (course, index) => course.slug + ':' + index;
const blankState = () => ({read:{},answers:{},tests:{},written:{},lastCourse:COURSES[0].slug,lastLesson:0});
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
function cleanState(raw) {
 if (!record(raw)) throw Error('Choose a valid progress export.');
 const out = blankState();
 for (const lesson of allLessons) {
  if (raw.read?.[lesson.id] === true) out.read[lesson.id] = true;
  const answer = raw.answers?.[lesson.id];
  if (record(answer) && Number.isInteger(answer.choice) && answer.choice >= 0 && answer.choice < lesson.options.length) {
   out.answers[lesson.id] = {choice:answer.choice,correct:answer.choice === lesson.answer};
  }
  if (typeof raw.written?.[lesson.id] === 'string') out.written[lesson.id] = raw.written[lesson.id].slice(0,12000);
 }
 for (const course of COURSES) course.tests.forEach((test,index) => {
  const key = testKey(course,index), source = raw.tests?.[key];
  if (!record(source) || !record(source.draft)) return;
  const draft = {};
  test.indices.forEach(i => {
   const lesson = course.lessons[i], choice = source.draft[lesson.id];
   if (Number.isInteger(choice) && choice >= 0 && choice < lesson.options.length) draft[lesson.id] = choice;
  });
  // Only validated, complete submissions may show as a submitted attempt.
  const submitted = source.submitted === true && test.indices.every(i => {
   const id = course.lessons[i].id;
   return Object.hasOwn(draft,id) && out.answers[id]?.choice === draft[id];
  });
  out.tests[key] = {draft,submitted};
 });
 if (COURSES.some(c => c.slug === raw.lastCourse)) out.lastCourse = raw.lastCourse;
 const course = COURSES.find(c => c.slug === out.lastCourse);
 if (Number.isInteger(raw.lastLesson) && raw.lastLesson >= 0 && raw.lastLesson < course.lessons.length) out.lastLesson = raw.lastLesson;
 return out;
}
let state = blankState(), storageOK = true;
try { const raw = localStorage.getItem(KEY); if (raw) state = cleanState(JSON.parse(raw)); } catch (_) { storageOK = false; }
let selected = COURSES.find(c => c.slug === state.lastCourse) || COURSES[0];
let lessonIndex = state.lastLesson, mode = 'learn', testIndex = 0;
function persist() {
 state.lastCourse = selected.slug; state.lastLesson = lessonIndex;
 try { localStorage.setItem(KEY,JSON.stringify(state)); storageOK = true; } catch (_) { storageOK = false; }
 $('#storageNotice').hidden = storageOK;
 updateTop();
}
function updateTop() {
 const count = allLessons.filter(l => state.read[l.id]).length;
 $('#topCount').textContent = count + ' / ' + allLessons.length + ' read';
}
function focusWorkspace() { $('#workspace').scrollIntoView({behavior:'smooth',block:'start'}); }
function selectCourse(slug, index = 0) {
 const course = COURSES.find(c => c.slug === slug); if (!course) return;
 selected = course; lessonIndex = index; testIndex = 0; mode = 'learn';
 persist(); render();
}
function render() {
 $('#subjects').innerHTML = COURSES.map((course,index) => {
  const count = course.lessons.filter(l => state.read[l.id]).length;
  return `<button class="subject-button ${course.slug === selected.slug ? 'active' : ''}" ${course.slug === selected.slug ? 'aria-current="true"' : ''} data-course="${esc(course.slug)}"><span class="subject-number">${String(index+1).padStart(2,'0')}</span><span class="subject-name">${esc(course.title)}<small>${count} of ${course.lessons.length} read</small></span><span class="subject-arrow" aria-hidden="true">↗</span></button>`;
 }).join('');
 $('#subjects').querySelectorAll('button').forEach(button => button.onclick = () => selectCourse(button.dataset.course));
 $('#subjectLabel').textContent = ['environment','professional'].includes(selected.slug) ? 'ELECTIVE SUBJECT / STUDY HANDOUT' : 'CORE SUBJECT / STUDY HANDOUT';
 $('#subjectTitle').textContent = selected.title; $('#scope').textContent = selected.scope;
 $('#handoutLink').href = 'downloads/' + selected.slug + '-handout.pdf';
 document.querySelectorAll('[data-mode]').forEach(button => {
  const active = button.dataset.mode === mode;
  button.setAttribute('aria-selected',String(active)); button.tabIndex = active ? 0 : -1;
 });
 $('#panel').setAttribute('aria-labelledby','tab' + mode[0].toUpperCase() + mode.slice(1));
 if (mode === 'learn') renderLearn();
 if (mode === 'practice') renderPractice();
 if (mode === 'progress') renderProgress();
 updateTop(); $('#storageNotice').hidden = storageOK;
}
const richList = (items, className = '') => `<ol class="${className}">${items.map(text => `<li>${mathText(text)}</li>`).join('')}</ol>`;
function renderReferenceCards(lesson) {
 if (!Array.isArray(lesson.references) || !lesson.references.length) return '';
 return `<section class="lesson-section reference-section"><p class="eyebrow">KEEP THESE CLOSE</p><h4>Related rules &amp; relationships</h4><div class="reference-grid">${lesson.references.map(item => `<details class="reference-card"><summary>${esc(item.title || 'Reference')}</summary><div class="reference-content">${item.why_it_matters ? `<p>${mathText(item.why_it_matters)}</p>` : ''}${item.formulas?.length ? `<div class="reference-formulas">${item.formulas.map(formula => `<div>${mathText(formula)}</div>`).join('')}</div>` : ''}${item.method?.length ? richList(item.method,'reference-method') : ''}${item.check ? `<div class="reference-check"><p class="eyebrow">TRY A QUICK CHECK</p><p>${mathText(item.check.question)}</p><details><summary>Reveal the reasoning</summary>${item.check.steps?.length ? richList(item.check.steps,'reference-method') : ''}<p>${mathText(item.check.answer)}</p></details></div>` : ''}${item.sources?.length ? `<p class="reference-sources">Explore further: ${item.sources.filter(source => /^https:\/\//.test(source.url)).map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a>`).join(' · ')}</p>` : ''}</div></details>`).join('')}</div></section>`;
}
function renderLearn() {
 const lesson = selected.lessons[lessonIndex], teaching = lesson.teaching || {};
 const objectives = teaching.objectives || [];
 const methods = teaching.method || [lesson.steps];
 const worked = teaching.worked || [lesson.example];
 const figure = selected.figure || (typeof FIGURES !== 'undefined' ? FIGURES[selected.slug] : null);
 const showFigure = figure && figure.lessonId === lesson.id;
 $('#panel').innerHTML = `<div class="lesson-toolbar"><div><label for="lessonSelect">CHOOSE YOUR LESSON</label><select id="lessonSelect">${selected.lessons.map((item,index) => `<option value="${index}" ${index === lessonIndex ? 'selected' : ''}>${String(index+1).padStart(2,'0')} / ${esc(item.title)}${state.read[item.id] ? ' · Read' : ''}</option>`).join('')}</select></div><span class="lesson-position">${String(lessonIndex+1).padStart(2,'0')} <span>/ ${String(selected.lessons.length).padStart(2,'0')}</span></span></div>
 <article class="lesson-card"><div class="lesson-opening"><p class="eyebrow"><span class="small-line"></span> LESSON ${String(lessonIndex+1).padStart(2,'0')}${state.read[lesson.id] ? '<span class="read-chip">Marked read</span>' : ''}</p><h3>${esc(lesson.title)}</h3>${objectives.length ? `<div class="objectives"><h4>By the end, you should be able to…</h4><ul>${objectives.map(text => `<li>${mathText(text)}</li>`).join('')}</ul></div>` : ''}</div>
 ${teaching.prerequisites ? `<div class="prerequisite"><span>BEFORE YOU START</span><p>${mathText(teaching.prerequisites)}</p></div>` : ''}
 <section class="lesson-section theory-card"><p class="eyebrow">01 / THEORY · UNDERSTAND THE IDEA</p><h4>The concept, in plain English.</h4><p>${mathText(lesson.concept)}</p></section>
 ${showFigure ? `<figure class="course-figure"><img src="${esc(figure.src)}" alt="${esc(figure.alt || figure.caption || lesson.title)}" loading="lazy"><figcaption>${mathText(figure.caption || '')}</figcaption></figure>` : ''}
 <section class="formula-card" aria-label="Key relationship"><div><span class="eyebrow">RULE / KEY RELATIONSHIP</span><span class="formula-tag">Keep the meaning in view</span></div>${renderRule(lesson.formula)}${teaching.assumptions ? `<p class="formula-note"><strong>Use this when:</strong> ${mathText(Array.isArray(teaching.assumptions) ? teaching.assumptions.join(' ') : teaching.assumptions)}</p>` : ''}</section>
 ${teaching.symbols?.length ? `<details class="symbol-guide"><summary>What do the symbols mean? <span>${teaching.symbols.length} symbols</span></summary><div class="table-scroll"><table><caption class="sr-only">Symbols in this lesson</caption><thead><tr><th scope="col">Symbol</th><th scope="col">Meaning</th><th scope="col">Unit</th></tr></thead><tbody>${teaching.symbols.map(item => `<tr><th scope="row">${typeset(item.symbol)}</th><td>${mathText(item.meaning)}</td><td>${mathText(item.unit || '—')}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
 <section class="lesson-section"><p class="eyebrow">02 / CHOOSE A METHOD</p><h4>A reliable route through the problem.</h4>${richList(methods,'method-list')}</section>
 <section class="worked-example"><div class="section-topline"><p class="eyebrow">03 / FOLLOW THE REASONING</p><span class="example-tag">WORKED EXAMPLE</span></div><h4>See each step connect.</h4><p class="example-context">${mathText(lesson.example)}</p>${richList(worked,'worked-steps')}</section>
 ${renderReferenceCards(lesson)}
 <aside class="mistake-note"><span class="mistake-icon" aria-hidden="true">!</span><div><p class="eyebrow">A COMMON WRONG TURN</p><p>${mathText(lesson.trap)}</p></div></aside>
 ${teaching.examTip ? `<div class="exam-tip"><span class="eyebrow">IN THE EXAM</span><p>${mathText(teaching.examTip)}</p></div>` : ''}
 ${teaching.selfCheck ? `<section class="self-check"><p class="eyebrow">04 / PAUSE &amp; RECALL</p><h4>A quick check, without looking back.</h4><p>${mathText(teaching.selfCheck.question)}</p><details><summary>Reveal the explanation</summary><div class="revealed-answer">${mathText(teaching.selfCheck.answer)}</div></details></section>` : ''}
 <section class="written-practice"><div class="section-topline"><p class="eyebrow">YOUR TURN</p><span class="example-tag">WRITTEN PRACTICE</span></div><h4>Put the method to work.</h4><p>${mathText(lesson.problem)}</p><label for="writtenDraft">Your working <span>(optional · saved in this browser)</span></label><textarea id="writtenDraft" rows="4" maxlength="12000" placeholder="Write your known quantities, equation, working and final answer…">${esc(state.written[lesson.id] || '')}</textarea><p class="draft-note" id="writtenStatus">Try the question before opening the solution.</p><details><summary>Reveal the worked solution &amp; marking guidance</summary><div class="revealed-answer">${mathText(lesson.solution)}</div><p class="caption">Compare your method, reasoning and units. This practice is self-reviewed and does not change your MCQ score.</p></details></section>
 <div class="lesson-completion"><div><h4>Ready to move on?</h4><p>Explain the idea aloud and reproduce the example without notes.</p></div><button id="markRead" class="${state.read[lesson.id] ? 'quiet completed' : 'primary'}">${state.read[lesson.id] ? '✓ Marked read · undo' : 'Mark lesson read ✓'}</button></div>
 <nav class="lesson-pagination" aria-label="Lesson navigation"><button id="prev" class="quiet" ${lessonIndex === 0 ? 'disabled' : ''}>← Previous lesson</button><button id="next" class="quiet" ${lessonIndex === selected.lessons.length-1 ? 'disabled' : ''}>Next lesson →</button></nav></article>`;
 $('#lessonSelect').onchange = event => { lessonIndex = Number(event.target.value); persist(); renderLearn(); };
 $('#prev').onclick = () => moveLesson(-1); $('#next').onclick = () => moveLesson(1);
 $('#markRead').onclick = () => { if (state.read[lesson.id]) delete state.read[lesson.id]; else state.read[lesson.id] = true; persist(); render(); };
 $('#writtenDraft').oninput = event => { state.written[lesson.id] = event.target.value; persist(); $('#writtenStatus').textContent = storageOK ? 'Your working is saved in this browser.' : 'Your working is in memory. Export progress to keep it.'; };
}
function moveLesson(delta) { lessonIndex = Math.max(0,Math.min(selected.lessons.length-1,lessonIndex+delta)); persist(); renderLearn(); $('#panel').scrollIntoView({behavior:'smooth',block:'start'}); }
function renderPractice() {
 const test = selected.tests[testIndex], lessons = test.indices.map(i => selected.lessons[i]);
 const key = testKey(selected,testIndex);
 const attempt = state.tests[key] || {draft:{},submitted:false};
 const submitted = attempt.submitted;
 const answered = lessons.filter(l => Object.hasOwn(attempt.draft,l.id)).length;
 $('#panel').innerHTML = `<div class="practice-heading"><p class="eyebrow">RETRIEVE. REASON. REVIEW.</p><h3>Find out what has stuck.</h3><p>Answer without notes, then check the explanations. Each question tests one lesson. For longer problems, use written practice in Learn or the printable practice book.</p></div><div class="test-choice" role="group" aria-label="Choose a concept check">${selected.tests.map((item,index) => `<button class="${index === testIndex ? 'active' : ''}" aria-pressed="${index === testIndex}" data-test="${index}"><span>CONCEPT CHECK</span><strong>${esc(item.name)}</strong><small>${item.indices.length} questions</small></button>`).join('')}</div><p class="draft-notice">${submitted ? 'Showing your latest submitted attempt for this check.' : 'Your choices are saved as a draft when you switch lessons, checks or subjects.'}</p><div id="score" aria-live="polite"></div><form id="quiz"><div class="quiz-topline"><span>${submitted ? 'ATTEMPT REVIEW' : 'YOUR ATTEMPT'}</span><span id="answeredCount">${answered} of ${lessons.length} answered</span></div>${lessons.map((lesson,index) => `<fieldset><legend><span>QUESTION ${String(index+1).padStart(2,'0')}</span><span>${esc(lesson.title)}</span></legend><p class="question">${mathText(lesson.q)}</p><div class="option-list">${lesson.options.map((option,choice) => `<label class="option ${submitted && choice === lesson.answer ? 'correct' : ''} ${submitted && attempt.draft[lesson.id] === choice && choice !== lesson.answer ? 'incorrect' : ''}"><input type="radio" name="${esc(lesson.id)}" value="${choice}" ${attempt.draft[lesson.id] === choice ? 'checked' : ''} ${submitted ? 'disabled' : 'required'}><span class="option-letter" aria-hidden="true">${String.fromCharCode(65+choice)}</span><span>${mathText(option)}</span></label>`).join('')}</div>${submitted ? feedback(lesson,attempt.draft[lesson.id]) : ''}</fieldset>`).join('')}<div class="quiz-actions">${submitted ? '<button class="primary" type="button" id="retry">Start a fresh attempt ↗</button>' : '<button class="primary" type="submit">Check my answers ↗</button>'}<a class="text-link" href="downloads/practice-tests-and-answers.pdf" download>Printable practice book ↓</a></div><p class="caption">Latest submitted answers replace earlier results for these questions. Drafts, written practice and repeated clicks do not add to your score.</p></form>`;
 document.querySelectorAll('[data-test]').forEach(button => button.onclick = () => { testIndex = Number(button.dataset.test); renderPractice(); });
 if (submitted) {
  showScore(lessons,attempt.draft);
  $('#retry').onclick = () => { state.tests[key] = {draft:{},submitted:false}; persist(); renderPractice(); };
 } else {
  $('#quiz').onchange = event => {
   if (event.target.type !== 'radio') return;
   attempt.draft[event.target.name] = Number(event.target.value); state.tests[key] = attempt; persist();
   $('#answeredCount').textContent = lessons.filter(l => Object.hasOwn(attempt.draft,l.id)).length + ' of ' + lessons.length + ' answered';
  };
  $('#quiz').onsubmit = event => {
   event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
   const data = new FormData(event.currentTarget);
   for (const lesson of lessons) { const choice = Number(data.get(lesson.id)); attempt.draft[lesson.id] = choice; state.answers[lesson.id] = {choice,correct:choice === lesson.answer}; }
   attempt.submitted = true; state.tests[key] = attempt; persist(); renderPractice(); $('#score').scrollIntoView({behavior:'smooth',block:'center'});
  };
 }
}
function feedback(lesson,choice) {
 return `<div class="feedback ${choice === lesson.answer ? 'feedback-correct' : ''}"><strong>${choice === lesson.answer ? 'Correct.' : 'Take another look.'} Answer ${String.fromCharCode(65+lesson.answer)}</strong><p>${mathText(lesson.why)}</p><button class="feedback-revise" type="button" data-revise="${esc(lesson.id)}">Revisit this lesson →</button></div>`;
}
function showScore(lessons,draft) {
 const correct = lessons.filter(l => draft[l.id] === l.answer).length, percent = Math.round(100*correct/lessons.length);
 $('#score').innerHTML = `<div class="score-card"><div><p class="eyebrow">LATEST ATTEMPT</p><h4>${correct} <span>/ ${lessons.length}</span></h4></div><div><strong>${percent}% correct</strong><p>${percent >= 80 ? 'A strong check. Explain the reasoning and retry after a delay.' : percent >= 60 ? 'A useful start. Work through the missed explanations before another attempt.' : 'Go back to the concepts and worked examples, then try again.'}</p></div></div>`;
 document.querySelectorAll('[data-revise]').forEach(button => button.onclick = () => { const index = selected.lessons.findIndex(l => l.id === button.dataset.revise); selectCourse(selected.slug,index); });
}
function renderProgress() {
 const attempted = allLessons.filter(l => state.answers[l.id]), correct = attempted.filter(l => state.answers[l.id].correct), read = allLessons.filter(l => state.read[l.id]);
 const weak = attempted.filter(l => !state.answers[l.id].correct);
 $('#panel').innerHTML = `<div class="practice-heading"><p class="eyebrow">YOUR REVISION RECORD</p><h3>See where to go next.</h3><p>Reading is your own checklist. MCQ performance uses the latest submitted answer to each unique question. These are study records, not a predicted exam grade.</p></div><div class="progress-grid"><div class="metric"><strong>${read.length}<small> / ${allLessons.length}</small></strong><span>lessons marked read</span><p>Self-marked completion</p></div><div class="metric"><strong>${attempted.length}<small> / ${allLessons.length}</small></strong><span>unique MCQs attempted</span><p>Submitted answers only</p></div><div class="metric"><strong>${attempted.length ? Math.round(100*correct.length/attempted.length)+'%' : '—'}</strong><span>correct on latest answers</span><p>${correct.length} correct out of ${attempted.length} attempted</p></div></div><h4 class="progress-subtitle">Across your subjects</h4><div class="progress-list">${COURSES.map(course => { const r = course.lessons.filter(l => state.read[l.id]).length, a = course.lessons.filter(l => state.answers[l.id]).length, k = course.lessons.filter(l => state.answers[l.id]?.correct).length; return `<div class="progress-row"><div class="progress-row-top"><button class="subject-progress-link" data-open-course="${esc(course.slug)}">${esc(course.title)} <span aria-hidden="true">↗</span></button><span>${r}/${course.lessons.length} read · ${k}/${a} correct</span></div><div class="progress-bar" role="progressbar" aria-label="${esc(course.title)} lessons marked read" aria-valuenow="${r}" aria-valuemin="0" aria-valuemax="${course.lessons.length}"><span style="width:${100*r/course.lessons.length}%"></span></div></div>`; }).join('')}</div><section class="revisit"><p class="eyebrow">YOUR NEXT GOOD STEP</p><h4>Revisit these ideas.</h4>${weak.length ? `<ul>${weak.map(lesson => `<li><button data-open-lesson="${esc(lesson.id)}">${esc(lesson.title)} <span aria-hidden="true">↗</span></button></li>`).join('')}</ul>` : `<p>${attempted.length ? 'No missed questions on your latest answers. Come back after a delay and check your recall.' : 'Submit a concept check to see which ideas need another look.'}</p>`}</section><section class="backup-section"><h4>Keep a copy of your progress.</h4><p>Progress and written drafts stay in this browser. Export a backup before switching devices or clearing browser data.</p><div class="progress-tools"><button id="export" class="quiet">Export progress ↓</button><button id="import" class="quiet">Import progress ↑</button><button id="reset" class="text-button danger">Reset progress</button><input id="importFile" type="file" accept="application/json,.json" hidden></div><div id="progressMessage" class="progress-message" aria-live="polite"></div></section>`;
 document.querySelectorAll('[data-open-course]').forEach(button => button.onclick = () => selectCourse(button.dataset.openCourse));
 document.querySelectorAll('[data-open-lesson]').forEach(button => button.onclick = () => { const course = COURSES.find(c => c.lessons.some(l => l.id === button.dataset.openLesson)); selectCourse(course.slug,course.lessons.findIndex(l => l.id === button.dataset.openLesson)); });
 $('#export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({version:1,...state},null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'level3-progress.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  $('#progressMessage').textContent = 'Progress exported, including written working and concept-check drafts.';
 };
 $('#import').onclick = () => $('#importFile').click();
 $('#importFile').onchange = importProgress;
 $('#reset').onclick = () => {
  $('#progressMessage').innerHTML = '<p>This clears all saved reading, MCQ answers and written drafts in this browser. Export a backup first if needed.</p><button id="confirmReset" class="quiet danger">Clear all progress</button> <button id="cancelReset" class="quiet">Cancel</button>';
  $('#cancelReset').onclick = () => { $('#progressMessage').textContent = 'Reset cancelled.'; };
  $('#confirmReset').onclick = () => { state = blankState(); lessonIndex = 0; persist(); render(); $('#progressMessage').textContent = 'Progress cleared.'; };
 };
}
async function importProgress(event) {
 const message = $('#progressMessage');
 try {
  const file = event.target.files[0]; if (!file) return;
  if (file.size > 2000000) throw Error('The file is too large. Choose a Study Studio progress export.');
  const raw = JSON.parse(await file.text());
  if (raw.version !== 1) throw Error('This progress version is not supported.');
  if (!record(raw.read) || !record(raw.answers)) throw Error('This file is missing its progress records.');
  const imported = cleanState(raw);
  message.innerHTML = `<p>Ready to import ${Object.keys(imported.read).length} read lessons and ${Object.keys(imported.answers).length} submitted answers. Merge keeps existing records and uses imported values where both exist. Replace clears the current record first.</p><button id="mergeImport" class="quiet">Merge progress</button> <button id="replaceImport" class="quiet">Replace current progress</button> <button id="cancelImport" class="text-button">Cancel</button>`;
  const finish = merge => {
   if (merge) {
    for (const part of ['read','answers','tests','written']) imported[part] = {...state[part],...imported[part]};
    state = cleanState(imported);
   } else state = imported;
   selected = COURSES.find(c => c.slug === state.lastCourse); lessonIndex = state.lastLesson; persist(); render(); $('#progressMessage').textContent = 'Progress imported successfully.';
  };
  $('#mergeImport').onclick = () => finish(true); $('#replaceImport').onclick = () => finish(false);
  $('#cancelImport').onclick = () => { message.textContent = 'Import cancelled. Your progress is unchanged.'; };
 } catch (error) { message.textContent = 'Import failed: ' + error.message; }
 event.target.value = '';
}
function setupSearch() {
 const input = $('#lessonSearch'), results = $('#searchResults');
 input.oninput = () => {
  const query = input.value.trim().toLocaleLowerCase(); results.hidden = !query;
  if (!query) { results.innerHTML = ''; return; }
  const found = COURSES.flatMap(course => course.lessons.map((lesson,index) => ({course,lesson,index}))).filter(({course,lesson}) => [course.title,lesson.title,lesson.concept,lesson.formula,...(lesson.teaching?.objectives || [])].join(' ').toLocaleLowerCase().includes(query)).slice(0,16);
  results.innerHTML = `<p>${found.length ? found.length + ' matching lessons' : 'No matches. Try a shorter topic or subject name.'}</p>` + found.map(({course,lesson,index}) => `<button data-result-course="${esc(course.slug)}" data-result-index="${index}"><span>${esc(lesson.title)}</span><small>${esc(course.title)}</small></button>`).join('');
  results.querySelectorAll('button').forEach(button => button.onclick = () => { selectCourse(button.dataset.resultCourse,Number(button.dataset.resultIndex)); results.hidden = true; input.value = ''; $('#panel').focus(); });
 };
 input.onkeydown = event => { if (event.key === 'Escape') { results.hidden = true; input.value = ''; } };
 document.addEventListener('keydown',event => { if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); input.focus(); } });
}
document.querySelectorAll('[data-mode]').forEach((button,index,buttons) => {
 button.onclick = () => { mode = button.dataset.mode; render(); };
 button.onkeydown = event => {
  if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
  event.preventDefault(); const next = event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons[buttons.length-1] : buttons[(index+(event.key === 'ArrowRight' ? 1 : buttons.length-1))%buttons.length]; next.click(); next.focus();
 };
});
$('#start').onclick = () => { mode = 'learn'; render(); focusWorkspace(); };
$('#progressTop').onclick = () => { mode = 'progress'; render(); focusWorkspace(); };
$('#about').onclick = () => $('#aboutDialog').showModal(); $('#closeAbout').onclick = () => $('#aboutDialog').close();
$('#aboutDialog').addEventListener('click',event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close(); } });
$('#courseCount').textContent = String(COURSES.length).padStart(2,'0');
$('#lessonCount').textContent = allLessons.length;
$('#testCount').textContent = COURSES.reduce((sum,c) => sum+c.tests.length,0);
$('#questionCount').textContent = allLessons.length * 2;
$('#subjectCounter').textContent = String(COURSES.length).padStart(2,'0') + ' subjects';
setupSearch(); render();


