// Test-only Peer API transport. BroadcastChannel replaces WebRTC, never production code.
(() => {
  class Events {
    constructor(){this.handlers={};}
    on(name,fn){(this.handlers[name] ||= []).push(fn);return this;}
    emit(name,...args){(this.handlers[name] || []).forEach(fn=>fn(...args));}
  }
  class Connection extends Events {
    constructor(owner,remote,id){super();this.owner=owner;this.remote=remote;this.id=id;this.open=false;}
    send(data){if(this.open)this.owner.post({type:'data',target:this.remote,cid:this.id,data});}
    close(){if(!this.open)return;this.open=false;this.owner.post({type:'close',target:this.remote,cid:this.id});this.emit('close');}
  }
  window.Peer=class extends Events {
    constructor(id){
      super();this.id=id || crypto.randomUUID();this.connections={};
      this.channel=new BroadcastChannel('duellen-browser-tests');
      this.channel.onmessage=({data:m})=>{
        if(m.target!==this.id)return;
        if(m.type==='offer'){
          const c=new Connection(this,m.sender,m.cid);this.connections[m.cid]=c;
          this.emit('connection',c);c.open=true;
          this.post({type:'accept',target:m.sender,cid:m.cid});c.emit('open');
        }
        const c=this.connections[m.cid];
        if(m.type==='accept' && c){c.open=true;c.emit('open');}
        if(m.type==='data' && c)c.emit('data',m.data);
        if(m.type==='close' && c){c.open=false;c.emit('close');}
      };
      queueMicrotask(()=>this.emit('open',this.id));
    }
    post(m){this.channel.postMessage({...m,sender:this.id});}
    connect(remote){const c=new Connection(this,remote,crypto.randomUUID());this.connections[c.id]=c;this.post({type:'offer',target:remote,cid:c.id});return c;}
    destroy(){Object.values(this.connections).forEach(c=>c.close());this.channel.close();}
  };
})();
