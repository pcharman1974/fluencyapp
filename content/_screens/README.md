# Story screenshots for picture extraction

Send the screens for a story as a zip, either PDFs (one screenshot each) or PNG/JPG images. The story
pictures are cropped from the area left of the text and saved under `content/<story>/images/`.

How it was done for The History of Women's Football (6 Oct 2026):

1. `pdfimages -png stories_NNN.pdf out` pulls the full-resolution screenshot out of each PDF.
2. `python3 app/scripts/crop_pictures.py <screen.png> <story>/images/NN.jpg` crops the picture
   (add `cover` as a third argument for the cover screen, which is a collage across the page).
   Needs Pillow and numpy.
3. Check every crop by eye (a contact sheet helps). One crop (page 8) needed redoing by hand because
   the photo had pale edges.
4. Set `image` and `imageAlt` for each page and `coverImage` in `story.json`, and `cover` in
   `app/src/lib/library.ts`.

Done: all eight stories (6 Oct 2026). Crops set or trimmed by hand: Inclusive Design 6, 10, 12; Inventions 2, 6;
Windrush 11; Carrot Girl 2; Home Invasion! 11. Carrot Girl and Home Invasion! have text-only pages, as in the originals.
