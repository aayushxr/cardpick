# Card artwork

Drop one image per card here, named by the card id in `src/lib/cards.ts`:

```
public/cards/horizon.jpg
public/cards/neo.jpg
public/cards/slice.png      (none yet, slice uses its colour)
public/cards/wow.avif
public/cards/wealth.webp
```

Landscape, the card's front face, around 1200 px wide. The app looks for `<id>.png`, then `.jpg`, `.jpeg`, `.webp`, `.avif`. To use another path set `image` on the card. The row and the top pick draw the image behind a dark scrim. If no file is found the card's `color` is used instead.

Keep these free of anything personal: crop or blur card numbers and names before committing, the repo is public.
