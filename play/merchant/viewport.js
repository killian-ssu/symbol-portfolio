(function(){
  'use strict';
  var outer=document.getElementById('viewport'), game=document.getElementById('GameDiv');
  var probe=document.getElementById('safe-area-probe'),last='',queued=false;
  var viewport=window.TMPlatform.viewport={revision:0};
  function layout(notify){
    var visual=window.visualViewport;
    var width=Math.min(window.innerWidth,document.documentElement.clientWidth||window.innerWidth);
    var height=Math.min(window.innerHeight,document.documentElement.clientHeight||window.innerHeight);
    if(visual){width=Math.min(width,visual.width);height=Math.min(height,visual.height);}
    var left=visual?visual.offsetLeft:0,top=visual?visual.offsetTop:0,css=getComputedStyle(probe);
    var insets={top:parseFloat(css.paddingTop)||0,right:parseFloat(css.paddingRight)||0,bottom:parseFloat(css.paddingBottom)||0,left:parseFloat(css.paddingLeft)||0};
    var signature=[width,height,left,top,insets.top,insets.right,insets.bottom,insets.left].join(',');
    if(last===signature)return;last=signature;
    outer.style.width=width+'px';outer.style.height=height+'px';outer.style.left=left+'px';outer.style.top=top+'px';
    game.style.width=Math.floor(width)+'px';game.style.height=Math.floor(height)+'px';
    viewport.width=Math.floor(width);viewport.height=Math.floor(height);viewport.left=left;viewport.top=top;viewport.insets=insets;viewport.revision++;
    if(notify)window.dispatchEvent(new Event('resize'));
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;layout(true);});}
  window.addEventListener('resize',function(){layout(false);});window.addEventListener('orientationchange',schedule);
  if(window.visualViewport){window.visualViewport.addEventListener('resize',schedule);window.visualViewport.addEventListener('scroll',schedule);}
  if(window.MutationObserver)new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});
  window.TMPlatform.layout=function(){layout(true);};layout(false);
}());
