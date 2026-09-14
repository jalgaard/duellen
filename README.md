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
