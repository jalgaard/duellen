# Duellen

Duellen är ett familjequiz i Jeopardy-stil med två separata vyer:

- **TV / spelplan** – visar kategorier, frågevärden, aktuell fråga, eventuellt rätt svar och poängställning.
- **Programledare** – körs på telefonen, innehåller spelplanen, frågan, facit och knappar för att dela ut eller dra av poäng.

## Så kör du

1. Lägg filerna på en vanlig webbserver eller GitHub Pages.
2. Öppna sidan på programledarens telefon och välj **Programledare**.
3. En fyrsiffrig spelkod skapas.
4. Öppna samma sida på TV:n (eller dator/Chromecast-webbläsare), välj **TV / spelplan** och skriv in koden.
5. Lägg in spelarnamn och tryck **Starta Duellen**.
6. Programledaren väljer frågor på mobilen. TV:n uppdateras direkt.

## Teknik

Synkningen mellan telefon och TV sker direkt mellan webbläsarna via WebRTC med PeerJS. Ingen databas eller inloggning behövs. Internetanslutning krävs för signaleringen och för att ladda PeerJS.

På vissa strikt brandväggade nät kan direkt WebRTC-trafik blockeras. För hemmabruk på vanligt Wi‑Fi brukar upplägget fungera bra.

## Anpassa frågor

Öppna `quiz.js`. Varje kategori innehåller fem frågor med `value`, `question` och `answer`.

## Filer

- `index.html` – startsida och scriptladdning
- `styles.css` – Duellen-grafiken
- `quiz.js` – frågor och facit
- `app.js` – spellogik, poäng och synkning

## Mobila svarsknappar

1. Programledaren öppnar ett spelrum som vanligt. Poängspelarnas namn och poäng hanteras fortfarande med de befintliga programledarkontrollerna.
2. Varje tävlande väljer **Tävlande**, skriver rumskoden och sitt namn och väljer en färg. Programledaren reserverar färgen; om någon annan hann välja den måste en annan färg väljas. Upp till åtta svarsknappar kan vara anslutna samtidigt.
3. Mobilen blir en stor färgad knapp som aktiveras när programledaren väljer en fråga. Första giltiga trycket som **tas emot av programledaren** vinner. Klienternas klockor används inte. Nätverksfördröjning kan påverka ordningen.
4. Vinnaren visas på TV:n och hos programledaren. Vinnande mobil visar **DU VAR FÖRST!**; övriga visar vem som hann först.
5. Vid fel svar väljer programledaren **Öppna knapparna igen**. Tidigare vinnare på samma fråga förblir spärrade, medan övriga kan försöka. Ny fråga återställer spärrarna. Varje öppning har ett nytt ID, och gamla signaler ignoreras.

Knapparna låses när facit visas, frågan stängs, spelet avslutas eller anslutningen bryts. Vid frånkoppling kan spelaren ansluta igen; färgen frigörs när programledaren upptäcker att anslutningen stängts. Ingen databas eller inloggning används. Signallänken och WebRTC behöver fungera på nätverket, precis som för TV-vyn.

## Lokal utveckling och test

Starta från repots rot:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
node --test tests/buzzer.test.cjs
```

Öppna sidan i separata webbläsarflikar för programledare, TV och tävlande. Kontrollera båda quizlägena och att TV:n inte visar facit före programledarens uttryckliga val.

`python3 tests/browser.py` kör flödestester med Python Playwright och systemets Chromium. Dessa tester simulerar Peer-transporten med BroadcastChannel, men kör den riktiga spelkoden för alla roller. De testar bland annat färgkonflikter, vinnare, låsning, återöppning, gamla buzz-signaler, poäng och facit i Familj/Barn.

För riktig lokal PeerJS/WebRTC-integration finns `python3 tests/browser.py --real`. Förbered först den lokala signalservern och samma PeerJS-version som produktionen använder:

```sh
npm install --prefix .tools/peer-server --no-package-lock --no-audit --no-fund peer@1.0.2
curl --fail --show-error https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js -o .tools/peerjs.min.js
.tools/peer-server/node_modules/.bin/peerjs --port 9000 --path /duellen
```

Starta därefter testet i en annan terminal medan webbservern körs. Testet använder lokal signalering och inga externa ICE-servrar. Webbläsarens nätverkspolicy måste tillåta WebRTC-datakanaler; simuleringens godkända tester bevisar inte att verklig WebRTC fungerar på ett visst nätverk. Även den publika signalservern bör kontrolleras vid manuell testning.
