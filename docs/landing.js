"use strict";
(() => {
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
    });
  });
})();
