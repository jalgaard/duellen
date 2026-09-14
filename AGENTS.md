# Duellen – projektkontext

Den här filen är beständig projektkontext för fortsatt utveckling av Duellen. Den bygger på den ursprungliga delade ChatGPT-konversationen:

https://chatgpt.com/share/6aa830a0-3ff0-83eb-aa45-426a0c2c5eb5

## Produktidé

Duellen är ett webbaserat quizspel i Jeopardy-stil för hemmabruk. Ett spelrum kopplar ihop två separata gränssnitt:

- **TV / spelplan:** visar kategorier, frågevärden, aktuell fråga, eventuellt rätt svar och poängställning. Facit får aldrig visas här innan programledaren väljer att visa det.
- **Programledare / mobil:** visar spelplan, fråga, facit och kontroller för att visa fråga/svar samt dela ut eller dra av poäng.

En fyrsiffrig kod kopplar ihop enheterna. Synkningen ska ske i realtid. Den nuvarande implementationen använder WebRTC via PeerJS och behöver ingen databas eller inloggning.

## Spelflöde och funktioner

- Valfritt antal spelare och spelarnamn.
- Fem kategorier med fem frågor per kategori.
- Frågevärden 100, 200, 300, 400 och 500 kr.
- Programledaren väljer frågor och styr vad som visas på TV:n.
- Använda frågor markeras eller försvinner.
- Plus- och minuspoäng ska kunna delas ut.
- Slutresultat och vinnarskärm ingår.
- Final Jeopardy nämndes som önskad funktion, men ska inte antas vara färdig utan kontroll i koden.
- Långsiktig idé: större frågebank, slumpmässiga quiz och valbara kategorier.

## Visuell riktning

Utgå från användarens uppladdade spelplansbild i originalchatten. Stilen beskrevs och implementerades som:

- djupblå TV-/gameshow-bakgrund,
- guldfärgade ramar,
- stora gula, lätt tredimensionella poängvärden,
- tydlig, dramatisk TV-programskänsla,
- mobilanpassad programledarvy.

Bevara den etablerade grafiska profilen vid nya funktioner om användaren inte uttryckligen ber om en ny design.

## Quizlägen

Målet är att programledaren före spelstart väljer mellan:

- **Familj:** de ursprungliga kategorierna Sverige, Världen, Sport, Film & TV och Blandat, med 25 fasta frågor.
- **Barn:** 25 andra frågor på ungefär 12-årsnivå, graderade från relativt lätt på 100 till märkbart svårare på 500. Kategorierna är Sverige, Världen, Natur & Vetenskap, Sport & Spel samt Film & Kultur.

Valt läge ska synkas till TV:n så att båda enheterna använder samma frågepaket.

## Aktuellt repoläge vid import 2026-09-14

GitHub-repot är `jalgaard/duellen` och publiceras via GitHub Pages på:

https://jalgaard.github.io/duellen/

Den lokalt hämtade `main`-grenen innehåller grundversionen med Familj-frågorna. Barn/Familj-versionen uppgavs vara färdig som en nedladdningsbar ZIP i originalchatten men hade inte kunnat pushas på grund av den tidigare ChatGPT-kopplingens 403/read-only-begränsning. Kontrollera därför alltid faktisk kod före påståenden om att Barn-läget är infört.

## Arbetsprinciper

- Behandla repots kod som sanningen om vad som för närvarande är implementerat.
- Bevara TV- och programledarvyn som separata roller i samma synkroniserade spel.
- Testa förändringar både i mobil/programledarläge och TV-läge.
- Lägg inte facit på TV:n förrän programledaren uttryckligen visar det.
- Behåll statisk hosting via GitHub Pages om inte användaren ber om en annan arkitektur.
