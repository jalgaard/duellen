"""Chromium integration tests. Default uses tests/peer-transport.js (simulated Peer transport).
Run: python3 tests/browser.py (static server must run on :8000).
Optional --real uses PeerJS/WebRTC with local signalling on :9000:
  npm install --prefix .tools/peer-server --no-package-lock peer@1.0.2
  .tools/peer-server/node_modules/.bin/peerjs --port 9000 --path /duellen
Cache production PeerJS 1.5.5 as .tools/peerjs.min.js for --real.
Real mode requires browser policy/network support for WebRTC data channels.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os
import sys

ROOT=Path(__file__).resolve().parents[1]
real='--real' in sys.argv
script=((ROOT/'.tools/peerjs.min.js').read_text() if real else (ROOT/'tests/peer-transport.js').read_text())+'''
const ProductionPeer=window.Peer;
window.Peer=class extends ProductionPeer {
  constructor(id) {
    super(id,{host:'127.0.0.1',port:9000,path:'/duellen',secure:false,config:{iceServers:[]},debug:2});
    window.testPeer=this;
    this.on('connection',c=>this.observe(c));
  }
  observe(c) {
    c.on('data',d=>{if(d.type==='state')window.testState=d.state;});
    const send=c.send.bind(c);
    c.send=d=>{if(d.type==='buzz')window.testBuzz=d;send(d);};
    window.testConnection=c;
    return c;
  }
  connect(...args){return this.observe(super.connect(...args));}
};
'''
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],proxy=({'server':os.environ['HTTPS_PROXY'],'bypass':'127.0.0.1,localhost'} if os.environ.get('HTTPS_PROXY') else None))
    context=browser.new_context()
    context.route('https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',lambda r:r.fulfill(body=script,content_type='application/javascript'))
    errors=[]
    def page(role=''):
        tab=context.new_page()
        tab.on('pageerror',lambda e:errors.append(str(e)))
        tab.goto('http://127.0.0.1:8000/'+('?role='+role if role else ''))
        return tab
    host=page()
    expect(host.locator('#contestant')).to_be_visible()
    host.locator('#host').click()
    expect(host.locator('.status-line')).to_contain_text('öppet',timeout=15000)
    room=host.locator('.room-code').inner_text()
    tv=page('tv')
    tv.locator('#room').fill(room)
    tv.locator('button[type=submit]').click()
    expect(tv.locator('.board .value')).to_have_count(25,timeout=15000)
    def prepare(name,color):
        tab=page('contestant')
        tab.set_viewport_size({'width':390,'height':844})
        tab.locator('#contestant-room').fill(room)
        tab.locator('#contestant-name').fill(name)
        tab.locator('[name=color][value='+color+']').check()
        return tab
    alice=prepare('Alice','red')
    bob=prepare('Bob','blue')
    clash=prepare('Charlie','red')
    alice.locator('button.btn.gold').click()
    expect(alice.locator('#buzz')).to_be_visible(timeout=15000)
    expect(alice.locator('#buzz')).to_be_disabled()
    clash.locator('button.btn.gold').click()
    expect(clash.locator('.notice')).to_contain_text('upptagen',timeout=15000)
    expect(clash.locator('[value=red]')).to_be_disabled()
    bob.locator('button.btn.gold').click()
    expect(bob.locator('#buzz')).to_be_visible(timeout=15000)
    expect(bob.locator('#buzz')).to_be_disabled()
    assert alice.locator('#buzz').bounding_box()['height']>=844
    print('PASS '+('real PeerJS/WebRTC' if real else 'simulated Peer transport')+': room, TV, contestants, color collision, mobile viewport')
    for mode,answer in [('family','Vänern'),('child','Kebnekaise')]:
        host.locator('[data-name]').nth(0).fill('Alice')
        host.locator('[data-name]').nth(1).fill('Bob')
        host.locator('[data-mode='+mode+']').click()
        host.locator('#start').click()
        expect(host.locator('[data-q]')).to_have_count(25)
        host.locator('[data-q="0-0"]').click()
        expect(alice.locator('#buzz')).to_be_enabled()
        expect(bob.locator('#buzz')).to_be_enabled()
        expect(tv.locator('.answer-reveal')).to_have_count(0)
        expect(host.locator('.answer-box')).to_contain_text(answer)
        tv.evaluate("testConnection.send({type:'buzz',round:testState.buzzer.round,id:testState.contestants[0].id})")
        host.wait_for_timeout(150)
        expect(host.locator('.buzzer-status')).to_have_text('Svarsknapparna är öppna')
        # Two close attempts: assert exactly one host-selected winner everywhere.
        alice.evaluate("document.querySelector('#buzz').click()")
        bob.evaluate("document.querySelector('#buzz').click()")
        expect(host.locator('.buzzer-status')).to_contain_text('Först:')
        winner=host.locator('.buzzer-status').inner_text().split(': ')[1]
        first,second=(alice,bob) if winner=='Alice' else (bob,alice)
        expect(first.locator('#buzz')).to_contain_text('DU VAR FÖRST!')
        expect(second.locator('#buzz')).to_contain_text(winner+' hann först')
        expect(tv.locator('.buzzer-status')).to_contain_text(winner)
        expect(first.locator('#buzz')).to_be_disabled()
        expect(second.locator('#buzz')).to_be_disabled()
        old=first.evaluate('window.testBuzz')
        host.locator('[data-score]').nth(0).click()
        expect(tv.locator('.scorebar')).to_contain_text('100 kr')
        host.locator('[data-score]').nth(1).click()
        expect(tv.locator('.scorebar')).not_to_contain_text('100 kr')
        host.locator('#reopen').click()
        expect(first.locator('#buzz')).to_be_disabled()
        expect(second.locator('#buzz')).to_be_enabled()
        # Inject a delayed old-round signal, then a forged identity from the excluded winner.
        first.evaluate('(old)=>testConnection.send(old)',old)
        first.evaluate("testConnection.send({type:'buzz',round:testState.buzzer.round,id:'forged'})")
        host.wait_for_timeout(150)
        expect(host.locator('.buzzer-status')).to_have_text('Svarsknapparna är öppna')
        second.locator('#buzz').click()
        expect(second.locator('#buzz')).to_contain_text('DU VAR FÖRST!')
        host.locator('#answer').click()
        expect(tv.locator('.answer-reveal')).to_have_text(answer)
        expect(host.locator('#reopen')).to_be_disabled()
        host.locator('#answer').click()
        expect(tv.locator('.answer-reveal')).to_have_count(0)
        host.locator('#board').click()
        expect(host.locator('[data-q="0-0"]')).to_be_disabled()
        expect(alice.locator('#buzz')).to_be_disabled()
        host.locator('[data-q="0-1"]').click()
        expect(alice.locator('#buzz')).to_be_enabled()
        first.evaluate('(old)=>testConnection.send(old)',old)
        host.wait_for_timeout(150)
        expect(host.locator('.buzzer-status')).to_have_text('Svarsknapparna är öppna')
        alice.locator('#buzz').click()
        expect(alice.locator('#buzz')).to_contain_text('DU VAR FÖRST!')
        host.locator('#finish').click()
        expect(tv.locator('.winner')).to_be_visible()
        expect(bob.locator('#buzz')).to_be_disabled()
        host.locator('#new-round').click()
        print('PASS '+mode+': questions, authoritative winner, lock, reopen, stale signals, scores +/-, TV answer secrecy/reveal, used tiles, final result')
    host.locator('#start').click()
    host.locator('[data-q="0-0"]').click()
    expect(alice.locator('#buzz')).to_be_enabled()
    host.locator('#answer').click()
    expect(alice.locator('#buzz')).to_be_disabled()
    expect(bob.locator('#buzz')).to_be_disabled()
    host.locator('#answer').click()
    host.once('dialog',lambda dialog:dialog.accept())
    host.locator('#reset').click()
    expect(host.locator('[data-q="0-0"]')).to_be_enabled()
    expect(tv.locator('.board .value.used')).to_have_count(0)
    expect(alice.locator('#buzz')).to_be_disabled()
    host.locator('[data-q="0-0"]').click()
    expect(alice.locator('#buzz')).to_be_enabled()
    alice.locator('#buzz').focus()
    alice.keyboard.press('Space')
    expect(alice.locator('#buzz')).to_contain_text('DU VAR FÖRST!')
    host.locator('#finish').click()
    host.locator('#new-round').click()
    print('PASS answer reveal locks unbuzzed round, reset, keyboard activation')
    alice.screenshot(path=str(ROOT/'.tools/mobile-buzzer.png'))
    alice.evaluate('testPeer.destroy()')
    alice.close()
    expect(host.locator('.notice')).not_to_contain_text('Alice (Röd)')
    clash.locator('[value=red]').check()
    clash.locator('button.btn.gold').click()
    expect(clash.locator('#buzz')).to_be_visible(timeout=15000)
    host.evaluate('testPeer.destroy()')
    host.close()
    expect(bob.locator('#contestant-form')).to_be_visible(timeout=20000)
    expect(bob.locator('.notice')).to_contain_text('bröts')
    assert not errors, errors
    print('PASS color release/rejoin, host disconnect locks clients, no JavaScript errors')
    browser.close()
