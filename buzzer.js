/* Host-owned buzzer rules. No client clocks are trusted. */
(function(root) {
  const colors = [
    {id:'red',name:'Röd',hex:'#ed5353'}, {id:'blue',name:'Blå',hex:'#57a6ff'},
    {id:'green',name:'Grön',hex:'#55d98b'}, {id:'yellow',name:'Gul',hex:'#ffd51a'},
    {id:'purple',name:'Lila',hex:'#bb8aff'}, {id:'orange',name:'Orange',hex:'#ff9f43'},
    {id:'pink',name:'Rosa',hex:'#ff8dc7'}, {id:'cyan',name:'Turkos',hex:'#45dce0'}
  ];
  // getRandomValues also works on ordinary HTTP LAN hosting.
  const token = () => Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
  const fresh = () => ({round:null,open:false,winner:null,excluded:[]});
  const open = (previous, again=false) => ({
    round:token(), open:true, winner:null,
    excluded:again ? [...previous.excluded, ...(previous.winner ? [previous.winner.id] : [])] : []
  });
  function join(contestants, connectionId, name, color) {
    if(contestants.some(p=>p.id===connectionId)) return 'Du är redan ansluten.';
    if(typeof name!=='string' || !name.trim() || name.trim().length>20) return 'Ange ett namn med 1–20 tecken.';
    if(!colors.some(c=>c.id===color)) return 'Välj en färg.';
    if(contestants.some(p=>p.color===color)) return 'Färgen är upptagen. Välj en annan.';
    contestants.push({id:connectionId,name:name.trim(),color});
    return null;
  }
  function buzz(buzzer, contestants, connectionId, round, active) {
    const player=contestants.find(p=>p.id===connectionId);
    if(!active || !player || !buzzer.open || buzzer.winner || round!==buzzer.round || buzzer.excluded.includes(connectionId)) return false;
    buzzer.winner={...player};
    buzzer.open=false;
    return true;
  }
  const api={colors,token,fresh,open,join,buzz};
  if(typeof module!=='undefined') module.exports=api;
  else root.DuellenBuzzer=api;
})(typeof window==='undefined' ? globalThis : window);
