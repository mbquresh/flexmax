"use strict";
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  const moving = () => !paused && !reducedMotion.matches;
  const activeAnimations = new Set();
  function animate(element, frames, settings) {
    if (!element || !moving() || !element.animate) return;
    const animation = element.animate(frames, settings);
    activeAnimations.add(animation);
    const clear = () => activeAnimations.delete(animation);
    animation.onfinish = clear;
    animation.oncancel = clear;
  }
  const options = {
    shrink: {tag:"Gym protected", title:"A smaller session. A day still moving.", description:"Start at 3:00 and keep 30 minutes of deep work. Your gym session stays at 3:30.", note:"The tradeoff: 30 fewer minutes of deep work.", blocks:[["15:00–15:30","Deep work","Shortened to 30 minutes","work"],["15:30–16:30","Gym","Unchanged","gym"]]},
    move: {tag:"Both kept", title:"A full session, a little later.", description:"Keep the gym at 3:30 and move deep work into an open hour at 5:00. Fixed commitments stay in place.", note:"The tradeoff: your free hour at 5:00 becomes work time.", blocks:[["15:30–16:30","Gym","Unchanged","gym"],["17:00–18:00","Deep work","Moved to an available hour","work"]]},
    trade: {tag:"Tradeoff shown", title:"Keep the work. Name what gives.", description:"A full hour of deep work at 3:00 overlaps the gym. In this example, choosing it means giving up today’s gym session.", note:"The tradeoff: today’s gym session is dropped. In the app, you choose before any change is saved.", blocks:[["15:00–16:00","Deep work","Full 60-minute session","work"],["15:30–16:30","Gym","Given up for this example","dropped"]]}
  };
  document.querySelectorAll('[data-option]').forEach(button => {
    button.addEventListener('click', () => {
      const choice = options[button.dataset.option];
      if (!choice) return;
      document.querySelectorAll('[data-option]').forEach(item => {
        const selected = item === button;
        item.classList.toggle('selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      ['tag','title','description','note'].forEach(key => { document.getElementById('result-' + key).textContent = choice[key]; });
      const blocks = document.getElementById('result-blocks');
      blocks.replaceChildren(...choice.blocks.map(([time, title, detail, type]) => {
        const block = document.createElement('div');
        block.className = 'result-block ' + type;
        [['span',time],['strong',title],['small',detail]].forEach(([tag,text]) => {const node=document.createElement(tag);node.textContent=text;block.append(node);});
        return block;
      }));
      animate(document.querySelector('.demo-result'), [{opacity:.65,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}], {duration:350,easing:'ease-out'});
      blocks.querySelectorAll('.result-block').forEach((block,index) => animate(block,[{opacity:0,transform:'translateX(18px)'},{opacity:1,transform:'translateX(0)'}],{duration:420,delay:index*80,easing:'cubic-bezier(.2,.7,.3,1)'}));
    });
  });
  // Run the three-stage illustration once. Visitors can pause, replay or select a stage.
  const scenes = [
    {title:'A day full of good intentions.', subtitle:'The plan is set. Then real life happens.', time:'8:00 AM', label:'The plan', heading:'Work first. Gym after.', body:'An hour of deep work at 1:00. A gym session at 3:30. It all fits on paper.', status:'Planned · 60 minutes', mark:'○'},
    {title:'The afternoon got away.', subtitle:'One missed block. The rest is still possible.', time:'2:47 PM', label:'The interruption', heading:'Deep work didn’t happen.', body:'There isn’t room for the full hour before the gym. Something needs to change.', status:'Missed · needs a decision', mark:'—'},
    {title:'The day is still yours.', subtitle:'Start with what’s possible now.', time:'2:47 PM', label:'A way forward', heading:'There’s room for a smaller session.', body:'Keep 30 minutes of deep work. Keep the gym at 3:30.', status:'Missed · accounted for', mark:'✓'}
  ];
  const sceneFields = {title:'scene-title',subtitle:'scene-subtitle',time:'scene-time',label:'scene-label',heading:'scene-heading',body:'scene-body',status:'scene-work-status',mark:'scene-work-mark'};
  let sceneIndex = 2;
  let timer;
  let playing = false;
  let inView = false;
  let hasStarted = false;
  const steps = [...document.querySelectorAll('[data-scene]')];
  const preview = document.querySelector('.preview');
  function stopTimer() {
    window.clearTimeout(timer);
    timer = undefined;
    steps.forEach(step => step.classList.remove('is-running'));
  }
  function renderScene(index) {
    sceneIndex = index;
    const scene = scenes[index];
    Object.entries(sceneFields).forEach(([key,id]) => { document.getElementById(id).textContent = scene[key]; });
    preview.dataset.sceneActive = String(index);
    steps.forEach((step,i) => {step.classList.toggle('active',i===index);step.setAttribute('aria-pressed',String(i===index));});
    [document.querySelector('.preview-title'),document.querySelector('.recovery-preview')].forEach(element => animate(element,[{opacity:.35,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:550,easing:'cubic-bezier(.2,.7,.3,1)'}));
    if(index===2) animate(document.getElementById('scene-work'),[{transform:'translateX(-5px)'},{transform:'translateX(0)'}],{duration:400,easing:'ease-out'});
  }
  function scheduleScene() {
    stopTimer();
    if (!playing || !moving() || !inView || document.hidden) return;
    if (sceneIndex>=2) {playing=false;return;}
    steps[sceneIndex].classList.add('is-running');
    timer = window.setTimeout(() => {renderScene(sceneIndex+1);scheduleScene();},4000);
  }
  steps.forEach((step,index)=>step.addEventListener('click',()=>{playing=false;stopTimer();renderScene(index);}));
  document.getElementById('replay-story').addEventListener('click',()=>{
    if(!moving()){playing=false;stopTimer();renderScene((sceneIndex+1)%3);return;}
    playing=true;renderScene(0);scheduleScene();
  });
  const toggle=document.getElementById('motion-toggle');
  function syncMotion() {
    document.body.classList.toggle('motion-paused',!moving());
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.textContent=paused?'Resume motion ▶':'Pause motion Ⅱ';
    document.getElementById('replay-story').textContent=moving()?'↻ Replay':'Next stage →';
    document.getElementById('replay-story').setAttribute('aria-label',moving()?'Replay recovery illustration':'Show next illustration stage');
    if(!moving()) activeAnimations.forEach(animation=>animation.cancel());
    scheduleScene();
  }
  toggle.addEventListener('click',()=>{paused=!paused;syncMotion();});
  reducedMotion.addEventListener('change',syncMotion);
  document.addEventListener('visibilitychange',scheduleScene);
  if ('IntersectionObserver' in window) {
    const storyObserver=new IntersectionObserver(entries=>{
      inView=entries[0].isIntersecting;
      if(inView&&!hasStarted&&moving()){hasStarted=true;playing=true;renderScene(0);}
      scheduleScene();
    },{threshold:.4});
    storyObserver.observe(preview);
    // No hidden CSS state: content remains readable if JS fails or motion is disabled.
    const revealObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        revealObserver.unobserve(entry.target);
        animate(entry.target,[{opacity:.25,transform:'translateY(22px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.2,.7,.3,1)'});
        entry.target.querySelectorAll('.meter span').forEach((bar,index)=>animate(bar,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:1000,delay:150+index*120,easing:'cubic-bezier(.2,.7,.3,1)'}));
      });
    },{threshold:.15});
    document.querySelectorAll('.section-heading,.demo-grid,.benefits article,.evidence,.faq,.access-inner').forEach(element=>revealObserver.observe(element));
  }
  syncMotion();
  animate(document.querySelector('.hero-copy'),[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:800,easing:'ease-out'});
})();
