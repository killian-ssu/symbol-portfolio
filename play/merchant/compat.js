// ES2017 runtime support for APIs used by this project's current bundle.
(function () {
  'use strict';
  function define(object,name,value){if(!object[name])Object.defineProperty(object,name,{value:value,writable:true,configurable:true});}
  function lengthOf(value){var n=Number(value);return n>0?Math.min(Math.floor(n),9007199254740991):0;}
  function flatten(source,depth,target){for(var i=0,n=lengthOf(source.length);i<n;i++){if(!(i in source))continue;var value=source[i];if(depth>0&&Array.isArray(value))flatten(value,depth-1,target);else target.push(value);}return target;}
  define(Array.prototype,'flat',function(depth){if(this==null)throw new TypeError('Invalid array');var d=depth===undefined?1:Number(depth);d=d>0?Math.floor(d):0;return flatten(Object(this),d,[]);});
  define(Array.prototype,'flatMap',function(mapper,thisArg){if(this==null||typeof mapper!=='function')throw new TypeError('Invalid flatMap');var source=Object(this),mapped=[],n=lengthOf(source.length);for(var i=0;i<n;i++)if(i in source){var value=mapper.call(thisArg,source[i],i,source);if(Array.isArray(value))flatten(value,1-1,mapped);else mapped.push(value);}return mapped;});
  define(Array.prototype,'findLast',function(predicate,thisArg){if(this==null||typeof predicate!=='function')throw new TypeError('Invalid findLast');var source=Object(this);for(var i=lengthOf(source.length)-1;i>=0;i--)if(predicate.call(thisArg,source[i],i,source))return source[i];});
  define(Object,'fromEntries',function(iterable){var result={},iterator=iterable[Symbol.iterator](),item;while(!(item=iterator.next()).done){var entry=item.value;if(entry===null||(typeof entry!=='object'&&typeof entry!=='function'))throw new TypeError('Invalid entry');Object.defineProperty(result,entry[0],{value:entry[1],enumerable:true,writable:true,configurable:true});}return result;});
  define(Promise.prototype,'finally',function(callback){var Constructor=this.constructor||Promise;if(typeof callback!=='function')return this.then(callback,callback);return this.then(function(value){return Constructor.resolve(callback()).then(function(){return value;});},function(reason){return Constructor.resolve(callback()).then(function(){throw reason;});});});
  define(String.prototype,'matchAll',function(pattern){
    if(this==null)throw new TypeError('Invalid string');var text=String(this),regex;
    if(pattern instanceof RegExp){if(!pattern.global)throw new TypeError('matchAll requires a global RegExp');regex=new RegExp(pattern.source,pattern.flags);regex.lastIndex=pattern.lastIndex;}
    else regex=new RegExp(pattern,'g');
    var done=false,iterator={next:function(){if(done)return {done:true};var match=regex.exec(text);if(!match){done=true;return {done:true};}if(match[0]===''){var i=regex.lastIndex;regex.lastIndex=i+(regex.unicode&&i+1<text.length&&text.charCodeAt(i)>=55296&&text.charCodeAt(i)<=56319&&text.charCodeAt(i+1)>=56320&&text.charCodeAt(i+1)<=57343?2:1);}return {value:match,done:false};}};
    iterator[Symbol.iterator]=function(){return this;};return iterator;
  });
}());
