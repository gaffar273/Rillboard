(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.TeacherStore=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const key=id=>'elixdraw-teaching-session-v2:'+id;
  function fingerprint(items){return JSON.stringify(items.map(e=>Object.fromEntries(Object.keys(e).filter(k=>!(e.type==='text'&&(k==='w'||k==='h'))).sort().map(k=>[k,e[k]]))));}
  return class TeacherStore{
    constructor(storage){this.storage=storage;}
    save(id,lesson,index,active,elements,revealed=index,responses={}){
      if(!id)throw new Error('A saved board is required for teaching.');
      const value=JSON.stringify({version:2,lesson,index,revealed,active,responses,fingerprint:fingerprint(elements),updatedAt:new Date().toISOString()});
      this.storage.setItem(key(id),value);
    }
    read(id){const text=this.storage.getItem(key(id));if(!text)return null;const data=JSON.parse(text);if(data.version!==2||!Number.isInteger(data.index)||data.index<0||!data.lesson)throw new Error('Saved lesson is invalid. Your drawing is still available.');return data;}
    static fingerprint(items){return fingerprint(items);}
  };
});
