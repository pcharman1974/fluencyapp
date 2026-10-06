# Content to review before pupils use it

Everything below was added for testing on 6 Oct 2026. It needs a check by the content team.

## Stories added from screenshots

The text of three stories was typed from screenshots of FFT Tutoring with the Lightning Squad:

- *The History of Women's Football* (Latoyah Innerarity);
- *Inclusive Design* (Catherine Baker);
- *The Once and Future Queen* (Joel Pollen);
- *Inventions That Changed The World* (Catherine Baker);
- *The Windrush Generation* (Latoyah Innerarity);
- *Carrot Girl* (Catherine Baker);
- *Home Invasion!* (Ewan Shepherd).

Please check it word for word against the originals. Boxed words match the originals. Italics (thoughts, the sword's inscription) are shown as plain text.

**Pictures:** All eight stories now have their covers and page pictures, cropped from screenshots, with descriptions written for screen readers (please check them). Add images under `content/<story>/images/` and set `image`, `imageAlt` and `coverImage` in `story.json`.

**Written for the app (drafts):**

- glossary definitions for the boxed words in both stories;
- warm-up words chosen for each page;
- page headings in *The History of Women's Football* and *The Once and Future Queen* (the original pages have none; *Inclusive Design* uses its own headings).

**Queries on the women's football text** (copied as printed; not changed):

- Page 4 says "British Ladies Football **Association**"; pages 3 and 5 say "British Ladies Football **Club**".
- Page 10: "banned all together" is probably meant to be "altogether".
- Page 15: the quotation marks around "the Lionesses victory at the 2022 Euros and their finals appearance" look like an editing slip.
- Page 7 has "a 50 year period" but "her 30-year career".
- Facts and figures (games played and won, goals, money raised, today's equivalents, crowd sizes) haven't been checked against sources.

**Queries on *The Once and Future Queen*** (copied as printed):

- Page 20 is missing a full stop after "the warring lands in the east". The audio adds the pause.
- Page 20 opens the knights' words with a single quotation mark and closes with a double one.
- Page 12: "and later Morgan, and not to mention the countless others" reads awkwardly.

**Queries on *Inclusive Design*:**

- Page 12 has a stray comma: "fixed to the side of the pool, allow people".
- Page 14 says "the differently abled". The content team may prefer different wording.

**Queries on *Inventions That Changed The World*** (copied as printed):

- Page 8: "saves people's lifes" should be "lives".
- Page 10: "The invention of smartphone" is missing "the".
- Page 6 and page 8 mix spaced hyphens with dashes around "Velcro®" and "Kevlar®".
- Dates and claims haven't been checked against sources: earmuffs 1873, sticky notes 1968/1980, Velcro 1948, Kevlar 1965 and "five times stronger than steel".

**Queries on *The Windrush Generation*** (copied as printed):

- Page 9: "un-used air aid shelters" is probably meant to be "air raid shelters".
- Page 2: "Where hundreds of Caribbean people left..." is a sentence fragment.
- Page 8: "much different"; page 14: "no-matter"; page 3: "un-affected". These are minor style points.
- Dates and figures haven't been checked against sources: fare £28, about £850 today; 8,000 miles; 22 days; nearly half a million people, 1948–1971; Sam King mayor 1983; Claudia Jones 1955 and 1958.

**Queries on *Home Invasion!*:**

- Page 4: "stationary" should be "stationery".
- Page 12: "“OK,” I admitted. “this is quite fun." uses a lower-case "this" after the quotation mark (also on page 11, "and this").

**Queries on *Carrot Girl*:**

- Page 12: "Marks, set, go!" may be deliberate wordplay on "On your marks".
- Page 20: "My skin grows orange" may be meant to be "glows".

**Length:** about 116 words a page (women's football), 104 (inclusive design) and 92 (*The Once and Future Queen*, over 20 pages), against 81 for Secret Stones. Longer pages mean longer reads in each session.

## Bonus-read passages (timed read)

`timed-passages/passages.json` holds ten passages of about 245 words each, written by Claude as drafts:

- seven short stories: The Last Bus, The New Kid, Lost in the Fog, The Phone on the Bench, Grandad's Shed, Stage Fright, The Fox and The Power Cut;
- two how-to pieces: Looking After Your Bike and Growing a Giant Sunflower.

**Level.** They're levelled to match *Home Invasion!*, at roughly Flesch–Kincaid grade 4.2 to 5.8 against 4.7 for *Home Invasion!*, with around 10 to 14 words a sentence. That's the easier end of the library (*Windrush* is about grade 11). If pupils move on to harder books, a second, harder set will be needed.

**How they're used.** The bonus read picks one at random that the pupil hasn't read. Once they've read all ten, it picks at random again, never repeating the one they read last time.

**Checks needed:**

- The content team should edit and check them before pupils see them.
- The sunflower piece says the flower bud turns to follow the sun. This is true of young sunflowers, but it should be checked against a source.

Until the passages are checked for equal difficulty, scores from different passages are only roughly comparable.
