(function () {
  'use strict';
  var offline=window.TMPlatform,cc=null,containers=[],lastRevision=-1,backgrounds=new WeakSet();
  function align(container,full) {
    var vp=offline.viewport,design=offline.layoutConfig.design;
    var safeW=Math.max(1,vp.width-vp.insets.left-vp.insets.right),safeH=Math.max(1,vp.height-vp.insets.top-vp.insets.bottom);
    var scale=Math.min(safeW/Math.max(design.width,offline.layoutConfig.minimumContentWidth||design.width),safeH/design.height);
    var widget=container.getComponent(cc.Widget);
    widget.left=vp.insets.left/scale;widget.right=vp.insets.right/scale;
    widget.top=vp.insets.top/scale;widget.bottom=vp.insets.bottom/scale;widget.updateAlignment();
    offline.layoutState={scale:scale,safeWidth:safeW,safeHeight:safeH,logicalWidth:vp.width/scale,logicalHeight:vp.height/scale};
  }
  function update() {
    if(!cc||!containers.length)return;
    if(lastRevision!==offline.viewport.revision){
      var vp=offline.viewport,d=offline.layoutConfig.design;
      var scale=Math.min(Math.max(1,vp.width-vp.insets.left-vp.insets.right)/Math.max(d.width,offline.layoutConfig.minimumContentWidth||d.width),Math.max(1,vp.height-vp.insets.top-vp.insets.bottom)/d.height);
      cc.view.setDesignResolutionSize(vp.width/scale,vp.height/scale,cc.ResolutionPolicy.SHOW_ALL);
      containers.forEach(function(pair){align(pair.safe,pair.full);});lastRevision=vp.revision;
    }
    containers.forEach(function(pair){
      pair.safe.children.forEach(function(layer){layer.children.forEach(function(root){
        var paths=offline.layoutConfig.backgrounds[root.name];if(!paths)return;
        paths.forEach(function(path){
          var node=path?root.getChildByPath(path):root;if(!node||backgrounds.has(node))return;
          // Only the reviewed background nodes target the full Canvas; UI remains inside the safe Widget container.
          var widget=node.getComponent(cc.Widget)||node.addComponent(cc.Widget);
          widget.target=pair.full;widget.isAlignTop=widget.isAlignBottom=widget.isAlignLeft=widget.isAlignRight=true;
          widget.top=widget.bottom=widget.left=widget.right=0;widget.alignMode=cc.Widget.AlignMode.ALWAYS;widget.updateAlignment();backgrounds.add(node);
        });
      });});
    });
  }
  offline.attachLayout=function(engine){cc=engine;cc.director.on(cc.Director.EVENT_BEFORE_UPDATE,update);};
  offline.safeRoot=function(root){
    for(var i=0;i<containers.length;i++)if(containers[i].full===root)return containers[i].safe;
    var node=new cc.Node('TapTapSafeAreaContainer');node.layer=root.layer;
    node.addComponent(cc.UITransform);root.addChild(node);
    var widget=node.addComponent(cc.Widget);widget.isAlignTop=widget.isAlignBottom=widget.isAlignLeft=widget.isAlignRight=true;
    widget.alignMode=cc.Widget.AlignMode.ALWAYS;widget.left=widget.right=widget.top=widget.bottom=0;
    containers.push({safe:node,full:root});lastRevision=-1;update();return node;
  };
}());
