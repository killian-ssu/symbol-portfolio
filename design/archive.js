(() => {
  const params=new URLSearchParams(location.search);
  const validProjects=['merchant','midnight'];
  const rows=[...document.querySelectorAll('.document-row')];
  const search=document.querySelector('#search');
  const project=document.querySelector('#project-filter');
  const category=document.querySelector('#category-filter');
  const tabs=[...document.querySelectorAll('[data-timeline-button]')];
  function showTimeline(name){
    if(!validProjects.includes(name))return;
    for(const tab of tabs)tab.setAttribute('aria-pressed',String(tab.dataset.timelineButton===name));
    for(const section of document.querySelectorAll('[data-timeline]'))section.hidden=section.dataset.timeline!==name;
  }
  function filter(updateURL=true){
    if(!search)return;
    const terms=search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count=0;
    for(const row of rows){
      const show=(project.value==='all'||project.value===row.dataset.project)&&(category.value==='all'||category.value===row.dataset.category)&&terms.every(term=>row.dataset.search.includes(term));
      row.hidden=!show;if(show)count++;
    }
    document.querySelector('#result-count').textContent=`显示 ${count} / ${rows.length} 份文档`;
    document.querySelector('#empty-state').hidden=count!==0;
    if(updateURL){const p=new URLSearchParams();if(project.value!=='all')p.set('project',project.value);if(category.value!=='all')p.set('category',category.value);if(search.value.trim())p.set('q',search.value.trim());const query=p.toString();history.replaceState(null,'',location.pathname+(query?'?'+query:'')+location.hash);}
  }
  for(const button of tabs)button.addEventListener('click',()=>showTimeline(button.dataset.timelineButton));
  for(const link of document.querySelectorAll('[data-project-jump]'))link.addEventListener('click',()=>showTimeline(link.dataset.projectJump));
  if(search){
    if(validProjects.includes(params.get('project'))){project.value=params.get('project');showTimeline(project.value);}
    if([...category.options].some(o=>o.value===params.get('category')))category.value=params.get('category');
    search.value=params.get('q')||'';
    const hashProject=location.hash.replace('#timeline-','');if(validProjects.includes(hashProject))showTimeline(hashProject);
    filter(false);
    search.addEventListener('input',()=>filter());
    project.addEventListener('change',()=>filter());category.addEventListener('change',()=>filter());
    document.querySelector('.catalog-controls').addEventListener('submit',e=>{e.preventDefault();filter();});
    function reset(){search.value='';project.value='all';category.value='all';filter();search.focus();}
    document.querySelector('#reset-filters').addEventListener('click',reset);
    document.querySelector('[data-reset]').addEventListener('click',reset);
  }
  const version=document.querySelector('#version-select');if(version)version.addEventListener('change',()=>{location.href=version.value;});
  const toc=document.querySelector('.toc details');if(toc&&matchMedia('(max-width:760px)').matches)toc.open=false;
  const headings=[...document.querySelectorAll('.prose h2,.prose h3')];
  if(headings.length&&'IntersectionObserver' in window){
    const anchors=[...document.querySelectorAll('.toc nav a')];
    const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){for(const a of anchors)a.classList.toggle('active',a.hash==='#'+encodeURIComponent(entry.target.id)||decodeURIComponent(a.hash)==='#'+entry.target.id);}}, {rootMargin:'-5% 0px -65% 0px'});
    headings.forEach(h=>observer.observe(h));
  }
})();
