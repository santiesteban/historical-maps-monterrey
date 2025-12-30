# Monterrey Viejo

Historical maps of Monterrey and Nuevo León.

## Project Structure

```
monterrey-viejo/
├── data/
│   └── maps/           # JSON metadata for each map
├── images/
│   └── maps/           # Map image files
├── templates/          # HTML templates
│   ├── gallery.html    # Gallery page template
│   └── map-detail.html # Map detail page template
├── build/
│   └── generate.js     # Build script
├── public/             # Generated static site (git-ignored)
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions workflow
```

## Development

### Prerequisites

- Node.js 18 or higher
- Python 3 (for local dev server)

### Adding a New Map

1. Add map image to `images/maps/`
2. Create JSON metadata file in `data/maps/` with this structure:

```json
{
  "id": "map001",
  "slug": "map-slug",
  "title": "Map Title",
  "author": "Author Name",
  "year": 1900,
  "yearDisplay": "c. 1900",
  "source": "Source Name",
  "sourceUrl": "https://source.url",
  "centerPoint": [25.6698, -100.3095],
  "imageWidth": 4000,
  "imageHeight": 3000,
  "metersPerPixel": 2.5,
  "rotation": 0,
  "defaultZoom": 14,
  "imageFile": "filename.jpg"
}
```

3. Run `npm run build` to regenerate the site

### Local Development

```bash
# Build the site
npm run build

# Build and serve locally on http://localhost:8000
npm run dev
```

### Build Process

The build script (`build/generate.js`):
1. Reads all JSON files from `data/maps/`
2. Generates `index.html` (gallery) from `templates/gallery.html`
3. Generates individual map pages (`{slug}.html`) from `templates/map-detail.html`
4. Copies images to `public/images/`

## Deployment

The site is automatically built and deployed to GitHub Pages when you push to the `main` branch.

### Manual Deployment

1. Enable GitHub Pages in repository settings
2. Set source to "GitHub Actions"
3. Push to main branch
4. Site will be available at `https://[username].github.io/monterrey-viejo/`

## Metadata Fields

Required fields:
- `id`: Unique identifier
- `slug`: URL-friendly identifier
- `title`: Map title
- `author`: Map author
- `year`: Year of creation
- `centerPoint`: [latitude, longitude]
- `imageWidth`: Image width in pixels
- `imageHeight`: Image height in pixels  
- `metersPerPixel`: Scale factor
- `rotation`: Rotation in degrees
- `defaultZoom`: Default Leaflet zoom level
- `imageFile`: Filename in images/maps/

Optional fields:
- `yearDisplay`: Display year (e.g., "c. 1700")
- `alternativeTitle`
- `institutionalAuthor`
- `century`
- `scale`
- `language`
- `dimensions`
- `series`
- `file`
- `classificationCode`
- `source`
- `sourceUrl`

## License

All rights reserved.
