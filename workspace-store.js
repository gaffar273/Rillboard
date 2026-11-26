(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WorkspaceStore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'local-excalidraw-workspace-v1';
  const clone = value => JSON.parse(JSON.stringify(value));
  // Loading sanitizes elements and assigns fresh IDs; history tracks visible edits.
  const content = scene => JSON.stringify({elements:scene.elements.map(e => Object.fromEntries(Object.keys(e)
    .filter(k => k !== 'id' && (k !== 'text' || e.type === 'text')).sort().map(k => [k,e[k]]))),background:scene.background});
  const cleanName = value => String(value || 'Untitled').trim().slice(0,100) || 'Untitled';
  return class WorkspaceStore {
    constructor(storage) {
      this.storage = storage;
      this.meta = JSON.parse(storage.getItem(KEY) || '{"boards":[],"activeId":null}');
      if (!Array.isArray(this.meta.boards)) throw new Error('The saved workspace could not be read.');
    }
    key(id) { return KEY + ':' + id; }
    readRecord(id = this.meta.activeId) {
      const board = JSON.parse(this.storage.getItem(this.key(id)) || 'null');
      if (!board || !Array.isArray(board.scene?.elements)) throw new Error('This board could not be opened.');
      return board;
    }
    readScene(id) { return this.readRecord(id).scene; }
    versionScene(id,version) {
      if (version.scene) return version.scene;
      const raw=this.storage.getItem(this.key(id)+':history:'+version.slot);
      if (!raw) throw new Error('A saved version could not be opened.');
      return JSON.parse(raw);
    }
    read(id = this.meta.activeId) {
      const record=this.readRecord(id);
      return {...record,versions:(record.versions||[]).map(v=>({at:v.at,scene:this.versionScene(id,v)}))};
    }
    writeRecord(id,scene,versions,oldVersions) {
      let entries=versions.slice(-20);
      if(this.storage.separateHistory){
        // Never overwrite a slot referenced by the durable board, even if it
        // will drop out of the next history. Publish the new references last.
        const occupied=new Set(oldVersions.map(v=>v.slot));
        let slot=0;
        entries=entries.map(version=>{
          if(!version.scene)return version;
          while(occupied.has(slot))slot++;
          this.storage.setItem(this.key(id)+':history:'+slot,JSON.stringify(version.scene));
          return {at:version.at,slot:slot++,count:version.scene.elements.length,name:version.scene.name};
        });
      }
      this.storage.setItem(this.key(id),JSON.stringify({scene,versions:entries}));
    }
    writeMeta(meta) { this.storage.setItem(KEY,JSON.stringify(meta)); this.meta = meta; }
    list(query = '', folder = '') {
      const term = query.toLocaleLowerCase().trim();
      return this.meta.boards.filter(b => (!folder || b.folder === folder) && (b.name+' '+b.folder).toLocaleLowerCase().includes(term))
        .sort((a,b) => b.updatedAt-a.updatedAt).map(clone);
    }
    current() { return this.meta.boards.find(b => b.id === this.meta.activeId); }
    conversation(id) {
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_:.\-]{1,200}$/.test(id)) throw new Error('Invalid conversation key.');
      return this.meta.boards.find(b => b.conversationId === id);
    }
    bindConversation(id, boardId = this.meta.activeId) {
      const existing = this.conversation(id), board = this.meta.boards.find(b => b.id === boardId);
      if (!board) throw new Error('Board not found.');
      if (existing && existing.id !== boardId) throw new Error('This conversation already has a board.');
      if (board.conversationId && board.conversationId !== id) throw new Error('This board belongs to another conversation.');
      this.writeMeta({...this.meta,boards:this.meta.boards.map(b => b.id === boardId ? {...b,conversationId:id} : b)});
    }
    create(scene, name = 'Untitled', folder = '') {
      const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      const board = {id,name:cleanName(name),folder:String(folder).trim().slice(0,80),updatedAt:Date.now()};
      const data = {scene:{...clone(scene),name:board.name},versions:[]};
      this.storage.setItem(this.key(id),JSON.stringify(data));
      this.writeMeta({...this.meta,activeId:id,boards:[...this.meta.boards,board]});
      return clone(data.scene);
    }
    open(id) {
      if (!this.meta.boards.some(b => b.id === id)) throw new Error('Board not found.');
      const scene = this.readScene(id);
      this.writeMeta({...this.meta,activeId:id});
      return scene;
    }
    save(scene, checkpoint = false) {
      const old = this.readRecord(), now = Date.now(), versions = [...(old.versions || [])];
      const id = this.meta.activeId;
      const previous = versions[versions.length-1];
      if (checkpoint || !previous || now-previous.at >= 60000) {
        const oldContent=content(old.scene);
        if(oldContent!==content(scene)&&(!previous||content(this.versionScene(id,previous))!==oldContent)){
          versions.push({at:now,scene:old.scene});
        }
      }
      this.writeRecord(id,scene,versions,old.versions||[]);
      this.writeMeta({...this.meta,boards:this.meta.boards.map(b => b.id === this.meta.activeId ? {...b,name:cleanName(scene.name),updatedAt:now} : b)});
    }
    organize(name, folder) {
      const data = this.readRecord(), id = this.meta.activeId;
      data.scene.name = cleanName(name);
      this.storage.setItem(this.key(id),JSON.stringify(data));
      this.writeMeta({...this.meta,boards:this.meta.boards.map(b => b.id === id ? {...b,name:data.scene.name,folder:String(folder).trim().slice(0,80),updatedAt:Date.now()} : b)});
      return data.scene.name;
    }
    checkpoint(scene) {
      this.save(scene);
      const data = this.readRecord(), last = data.versions.at(-1), id=this.meta.activeId;
      if (!last || content(this.versionScene(id,last)) !== content(scene)) {
        this.writeRecord(id,scene,[...data.versions,{at:Date.now(),scene}],data.versions);
      }
    }
    history() { return clone(this.read().versions || []).reverse(); }
    historySummaries() {
      const id=this.meta.activeId;
      return (this.readRecord(id).versions||[]).slice().reverse().map(version=>{
        if(Number.isInteger(version.count))return {at:version.at,count:version.count,name:version.name};
        const scene=this.versionScene(id,version);
        return {at:version.at,count:scene.elements.length,name:scene.name};
      });
    }
    restore(index, current) {
      const versions=this.readRecord().versions||[];
      const version=versions[versions.length-1-index];
      if (!version) throw new Error('Version not found.');
      const scene = {...this.versionScene(this.meta.activeId,version),name:current.name};
      this.checkpoint(current);
      this.save(scene,true);
      return clone(scene);
    }
    duplicate(id) {
      const board = this.meta.boards.find(b => b.id === id);
      if (!board) throw new Error('Board not found.');
      return this.create(this.readScene(id),board.name+' (copy)',board.folder);
    }
  };
});
